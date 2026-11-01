/**
 * Spotify Web API client. Must be required only from main process.
 * Uses tokenStore for tokens and refreshes when needed.
 */
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if expires in < 5 min

// Rate limit tracking
let rateLimitUntil = 0; // Timestamp when rate limit expires
let lastSuccessfulRequest = 0; // Track last successful request time

/**
 * Refresh access token using refresh_token (PKCE: no client_secret).
 * @param {{ refresh_token: string }} tokens
 * @param {{ clientId: string }} config
 * @param {{ setTokens: (t: object) => void, getTokens: () => object }} tokenStore
 */
async function refreshAccessToken(tokens, config, tokenStore) {
  const params = {
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: config.clientId,
  };
  if (config.clientSecret) {
    params.client_secret = config.clientSecret;
  }
  const body = new URLSearchParams(params);
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Refresh failed');
  }
  const newTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_in: data.expires_in,
    user_id: tokens.user_id,
  };
  tokenStore.setTokens(newTokens);
  return newTokens.access_token;
}

let activeRefreshPromise = null;

/**
 * Get a valid access token, refreshing if necessary (with in-flight deduplication).
 * @param tokenStore
 * @param config { clientId: string }
 * @returns {Promise<string>}
 */
async function getValidToken(tokenStore, config) {
  const tokens = tokenStore.getTokens();
  if (!tokens) throw new Error('Not authenticated');
  const now = Date.now();
  const expiresAt = typeof tokens.expires_at === 'number' ? tokens.expires_at : 0;
  if (expiresAt - REFRESH_BUFFER_MS > now && tokens.access_token) {
    return tokens.access_token;
  }
  if (!activeRefreshPromise) {
    activeRefreshPromise = refreshAccessToken(tokens, config, tokenStore)
      .finally(() => {
        activeRefreshPromise = null;
      });
  }
  return activeRefreshPromise;
}

/**
 * @param tokenStore
 * @param config
 * @param path - e.g. '/me/player'
 * @param options - { method?, body?, _isRetry? }
 */
async function request(tokenStore, config, path, options = {}) {
  // Check if we're rate limited
  const now = Date.now();
  if (now < rateLimitUntil) {
    const waitMs = rateLimitUntil - now;
    const err = new Error(`Rate limited. Retry after ${Math.ceil(waitMs / 1000)}s`);
    err.status = 429;
    err.retryAfter = waitMs;
    throw err;
  }

  const token = await getValidToken(tokenStore, config);
  const url = path.startsWith('http') ? path : `${SPOTIFY_API_BASE}${path}`;
  const init = {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (options.body !== undefined) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) {
    lastSuccessfulRequest = now;
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Auto-retry on 401 Unauthorized (token revoked or prematurely invalidated)
    if (res.status === 401 && !options._isRetry) {
      try {
        const refreshedToken = await refreshAccessToken(tokenStore.getTokens(), config, tokenStore);
        if (refreshedToken) {
          return request(tokenStore, config, path, { ...options, _isRetry: true });
        }
      } catch (refreshErr) {
        console.warn('[SpotifyAPI] Auto 401 refresh retry failed:', refreshErr.message);
      }
    }

    // Handle rate limiting (429)
    if (res.status === 429) {
      // Check Retry-After header (seconds) or default to exponential backoff
      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
      rateLimitUntil = now + (retryAfterSeconds * 1000);
      const err = new Error(`Rate limited. Retry after ${retryAfterSeconds}s`);
      err.status = 429;
      err.retryAfter = retryAfterSeconds * 1000;
      throw err;
    }
    let message = data.error?.message || `HTTP ${res.status}`;
    if (res.status === 403) {
      message =
        '403: Add your Spotify account in the Developer Dashboard. ' +
        'Go to https://developer.spotify.com/dashboard, open your app, Settings > User Management, add your email.';
    }
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  lastSuccessfulRequest = now;
  return data;
}

async function getPlayer(tokenStore, config) {
  return request(tokenStore, config, '/me/player?additional_types=track,episode');
}

async function getRecentlyPlayed(tokenStore, config) {
  return request(tokenStore, config, '/me/player/recently-played?limit=25');
}

async function getQueue(tokenStore, config) {
  return request(tokenStore, config, '/me/player/queue');
}

let clientCredentialsToken = null;
let clientCredentialsExpiry = 0;

async function getClientCredentialsToken(config) {
  const now = Date.now();
  if (clientCredentialsToken && now < clientCredentialsExpiry - 60000) {
    return clientCredentialsToken;
  }
  const clientId = config?.clientId || config?.SPOTIFY_CLIENT_ID;
  const clientSecret = config?.clientSecret || config?.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return null;
    const data = await res.json();
    clientCredentialsToken = data.access_token;
    clientCredentialsExpiry = now + (data.expires_in * 1000);
    return clientCredentialsToken;
  } catch (err) {
    console.error('[SpotifyAPI] Client credentials token error:', err.message);
    return null;
  }
}

async function searchTrack(config, query) {
  const token = await getClientCredentialsToken(config);
  if (!token || !query) return null;
  try {
    const url = `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.tracks?.items?.[0] || null;
  } catch (_) {
    return null;
  }
}

async function getPlaylist(tokenStore, config, playlistId, fields = null) {
  const query = fields ? `?fields=${encodeURIComponent(fields)}` : '';
  try {
    return await request(tokenStore, config, `/playlists/${playlistId}${query}`);
  } catch (err) {
    try {
      const token = await getClientCredentialsToken(config);
      if (token) {
        const res = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) return await res.json();
      }
    } catch (_) {}
    throw err;
  }
}

async function getAlbum(tokenStore, config, albumId) {
  return request(tokenStore, config, `/albums/${albumId}`);
}

async function getFallbackQueue(config, title, artist) {
  const token = await getClientCredentialsToken(config);
  if (!token) return { items: [] };

  try {
    const cleanT = (title || '')
      .replace(/\s*[\(\[](feat|ft|with|remaster|mix|version|deluxe|bonus|radio|edit|live).*?[\)\]]/gi, '')
      .trim();
    const cleanA = (artist || '').trim();
    const movieMatch = (title || '').match(/[\(\[]from\s+["']?([^"'\)\]]+)["']?[\)\]]/i);
    const movieName = movieMatch ? movieMatch[1].trim() : '';

    const query = `${cleanT} ${cleanA}`.trim();
    const track = await searchTrack(config, query);

    if (track && track.album?.id) {
      const albumUrl = `${SPOTIFY_API_BASE}/albums/${track.album.id}/tracks?limit=30`;
      const res = await fetch(albumUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const raw = data.items || [];
        const items = raw
          .filter((t) => t.id && t.name.toLowerCase() !== cleanT.toLowerCase())
          .slice(0, 25)
          .map((t) => ({
            id: t.id,
            uri: t.uri,
            title: t.name,
            artist: (t.artists || []).map((a) => a.name).join(', '),
            albumArt: track.album?.images?.[0]?.url,
            duration_ms: t.duration_ms,
          }));
        if (items.length > 0) {
          return { items, source: `Album: ${track.album.name}` };
        }
      }
    }

    if (movieName) {
      try {
        const searchUrl = `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(movieName + ' soundtrack')}&type=album&limit=2`;
        const res = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const alb = data.albums?.items?.[0];
          if (alb && alb.id) {
            const trUrl = `${SPOTIFY_API_BASE}/albums/${alb.id}/tracks?limit=30`;
            const trRes = await fetch(trUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (trRes.ok) {
              const trData = await trRes.json();
              const items = (trData.items || [])
                .filter((t) => t.id)
                .slice(0, 25)
                .map((t) => ({
                  id: t.id,
                  uri: t.uri,
                  title: t.name,
                  artist: (t.artists || []).map((a) => a.name).join(', '),
                  albumArt: alb.images?.[0]?.url,
                  duration_ms: t.duration_ms,
                }));
              if (items.length > 0) {
                return { items, source: `Soundtrack: ${alb.name}` };
              }
            }
          }
        }
      } catch (_) {}
    }

    if (track && track.artists?.[0]?.id) {
      const artistUrl = `${SPOTIFY_API_BASE}/artists/${track.artists[0].id}/top-tracks?market=US`;
      const res = await fetch(artistUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const raw = data.tracks || [];
        const items = raw
          .filter((t) => t.id !== track.id)
          .slice(0, 25)
          .map((t) => ({
            id: t.id,
            uri: t.uri,
            title: t.name,
            artist: (t.artists || []).map((a) => a.name).join(', '),
            albumArt: t.album?.images?.[0]?.url || track.album?.images?.[0]?.url,
            duration_ms: t.duration_ms,
          }));
        if (items.length > 0) {
          return { items, source: `Artist: ${track.artists[0].name} Top Tracks` };
        }
      }
    }
  } catch (_) {}

  return { items: [], source: 'Queue' };
}

async function getCurrentUser(tokenStore, config) {
  return request(tokenStore, config, '/me');
}

async function getDevices(tokenStore, config) {
  return request(tokenStore, config, '/me/player/devices');
}

async function transferPlayback(tokenStore, config, deviceIds, play) {
  return request(tokenStore, config, '/me/player', {
    method: 'PUT',
    body: { device_ids: deviceIds, play: !!play },
  });
}

async function play(tokenStore, config, options = {}) {
  const body = {};
  if (options.uris) body.uris = options.uris;
  if (options.context_uri) body.context_uri = options.context_uri;
  if (options.offset !== undefined) body.offset = options.offset;
  if (options.position_ms !== undefined) body.position_ms = options.position_ms;

  let deviceId = options.deviceId;
  if (!deviceId) {
    try {
      const devs = await getDevices(tokenStore, config);
      const list = devs?.devices || [];
      const active = list.find((d) => d.is_active);
      const comp = list.find((d) => d.type === 'Computer');
      deviceId = (active || comp || list[0])?.id;
    } catch (_) {}
  }

  let path = '/me/player/play';
  if (deviceId) {
    path += `?device_id=${encodeURIComponent(deviceId)}`;
  }

  return request(tokenStore, config, path, {
    method: 'PUT',
    body: Object.keys(body).length ? body : undefined,
  });
}

async function pause(tokenStore, config) {
  return request(tokenStore, config, '/me/player/pause', {
    method: 'PUT',
  });
}

async function skipNext(tokenStore, config) {
  return request(tokenStore, config, '/me/player/next', {
    method: 'POST',
  });
}

async function skipPrevious(tokenStore, config) {
  return request(tokenStore, config, '/me/player/previous', {
    method: 'POST',
  });
}

async function setVolume(tokenStore, config, volumePercent) {
  return request(tokenStore, config, `/me/player/volume?volume_percent=${Math.round(volumePercent)}`, {
    method: 'PUT',
  });
}

async function seek(tokenStore, config, positionMs) {
  return request(tokenStore, config, `/me/player/seek?position_ms=${Math.round(positionMs)}`, {
    method: 'PUT',
  });
}

async function setShuffle(tokenStore, config, state) {
  return request(tokenStore, config, `/me/player/shuffle?state=${!!state}`, {
    method: 'PUT',
  });
}

async function setRepeat(tokenStore, config, state) {
  return request(tokenStore, config, `/me/player/repeat?state=${state}`, {
    method: 'PUT',
  });
}

async function checkUserSavedTracks(tokenStore, config, trackIds) {
  if (!trackIds || !trackIds.length) return [];
  const ids = Array.isArray(trackIds) ? trackIds.join(',') : trackIds;
  try {
    const res = await request(tokenStore, config, `/me/tracks/contains?ids=${encodeURIComponent(ids)}`);
    return Array.isArray(res) ? res : [];
  } catch (_) {
    return [];
  }
}

async function saveUserTracks(tokenStore, config, trackIds) {
  if (!trackIds || !trackIds.length) return null;
  const ids = Array.isArray(trackIds) ? trackIds.join(',') : trackIds;
  return request(tokenStore, config, `/me/tracks?ids=${encodeURIComponent(ids)}`, {
    method: 'PUT',
  });
}

async function removeUserTracks(tokenStore, config, trackIds) {
  if (!trackIds || !trackIds.length) return null;
  const ids = Array.isArray(trackIds) ? trackIds.join(',') : trackIds;
  return request(tokenStore, config, `/me/tracks?ids=${encodeURIComponent(ids)}`, {
    method: 'DELETE',
  });
}

module.exports = {
  getValidToken,
  getPlayer,
  getRecentlyPlayed,
  getQueue,
  getPlaylist,
  getAlbum,
  getClientCredentialsToken,
  searchTrack,
  getFallbackQueue,
  getCurrentUser,
  getDevices,
  transferPlayback,
  play,
  pause,
  skipNext,
  skipPrevious,
  setVolume,
  seek,
  setShuffle,
  setRepeat,
  checkUserSavedTracks,
  saveUserTracks,
  removeUserTracks,
  request,
};
