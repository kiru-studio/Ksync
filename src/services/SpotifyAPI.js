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
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: config.clientId,
  });
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

/**
 * Get a valid access token, refreshing if necessary.
 * @param tokenStore
 * @param config { clientId: string }
 * @returns {Promise<string>}
 */
async function getValidToken(tokenStore, config) {
  const tokens = tokenStore.getTokens();
  if (!tokens) throw new Error('Not authenticated');
  const now = Date.now();
  const expiresAt = typeof tokens.expires_at === 'number' ? tokens.expires_at : 0;
  if (expiresAt - REFRESH_BUFFER_MS > now) {
    return tokens.access_token;
  }
  return refreshAccessToken(tokens, config, tokenStore);
}

/**
 * @param tokenStore
 * @param config
 * @param path - e.g. '/me/player'
 * @param options - { method?, body? }
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
  // Request both track and episode so we get current playback for music and podcasts
  return request(tokenStore, config, '/me/player?additional_types=track,episode');
}

async function getQueue(tokenStore, config) {
  return request(tokenStore, config, '/me/player/queue');
}

async function play(tokenStore, config, body) {
  return request(tokenStore, config, '/me/player/play', { method: 'PUT', body: body || {} });
}

async function pause(tokenStore, config) {
  return request(tokenStore, config, '/me/player/pause', { method: 'PUT' });
}

async function skipNext(tokenStore, config) {
  return request(tokenStore, config, '/me/player/next', { method: 'POST' });
}

async function skipPrevious(tokenStore, config) {
  return request(tokenStore, config, '/me/player/previous', { method: 'POST' });
}

async function setVolume(tokenStore, config, volumePercent) {
  return request(tokenStore, config, `/me/player/volume?volume_percent=${volumePercent}`, { method: 'PUT' });
}

async function seek(tokenStore, config, positionMs) {
  return request(tokenStore, config, `/me/player/seek?position_ms=${positionMs}`, { method: 'PUT' });
}

async function setShuffle(tokenStore, config, state) {
  return request(tokenStore, config, `/me/player/shuffle?state=${state}`, { method: 'PUT' });
}

async function setRepeat(tokenStore, config, state) {
  return request(tokenStore, config, `/me/player/repeat?state=${state}`, { method: 'PUT' });
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

module.exports = {
  getValidToken,
  getPlayer,
  getQueue,
  play,
  pause,
  skipNext,
  skipPrevious,
  setVolume,
  seek,
  setShuffle,
  setRepeat,
  getCurrentUser,
  getDevices,
  transferPlayback,
  request,
};
