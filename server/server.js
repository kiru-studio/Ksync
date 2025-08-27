const express = require('express');
const cors = require('cors');
const SpotifyWebApi = require('spotify-web-api-node');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Add health check endpoint for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware
app.use(cors());
app.use(express.json());

// Spotify API configuration
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/callback'
});

// Store tokens (in production, use a proper database)
let accessTokens = new Map();

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Spotiffy Backend API' });
});

// Spotify OAuth endpoints
app.get('/auth/spotify', (req, res) => {
  // Minimal, broadly allowed scopes needed for playback control and status
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ];

  const authUrl = spotifyApi.createAuthorizeURL(scopes);
  res.json({ authUrl });
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;
    
    // Store tokens (in production, save to database)
    const userId = 'default'; // You can implement user management
    accessTokens.set(userId, {
      access_token,
      refresh_token,
      expires_in: Date.now() + expires_in * 1000
    });
    
    // Redirect to success page
    res.send(`
      <html>
        <head><title>Authentication Successful</title></head>
        <body>
          <h1>Authentication Successful!</h1>
          <p>You can now close this window and return to Spotiffy Dock.</p>
          <script>
            window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', token: '${access_token}' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Spotify API endpoints
app.get('/api/current-track', async (req, res) => {
  try {
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Refresh token if expired
    if (Date.now() > tokens.expires_in) {
      await refreshAccessToken(userId, tokens.refresh_token);
    }

    spotifyApi.setAccessToken(accessTokens.get(userId).access_token);
    
    const currentTrack = await spotifyApi.getMyCurrentPlaybackState();

    if (currentTrack.body && currentTrack.body.item) {
      const track = currentTrack.body.item;
      res.json({
        id: track.id,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url,
        duration: track.duration_ms / 1000,
        progress: currentTrack.body.progress_ms / 1000,
        progressMs: currentTrack.body.progress_ms,
        isPlaying: currentTrack.body.is_playing,
        volume: currentTrack.body.device?.volume_percent || 50,
        contextUri: currentTrack.body.context?.uri || null,
        serverTimestamp: Date.now()
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error getting current track:', error);
    res.status(500).json({ error: 'Failed to get current track' });
  }
});

app.get('/api/queue', async (req, res) => {
  try {
    const userId = 'default';
    let tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Refresh token if expired
    if (Date.now() > tokens.expires_in) {
      await refreshAccessToken(userId, tokens.refresh_token);
      tokens = accessTokens.get(userId);
    }

    // Ensure SpotifyWebApi uses a valid token for subsequent calls
    spotifyApi.setAccessToken(tokens.access_token);

    // Always fetch playback state first to know context and current item
    const playback = await spotifyApi.getMyCurrentPlaybackState();
    const currentUri = playback.body?.item?.uri || null;
    const ctx = playback.body?.context;
    const shuffle = !!playback.body?.shuffle_state;
    const repeat = playback.body?.repeat_state || 'off';

    // Try official queue endpoint
    const resp = await axios.get('https://api.spotify.com/v1/me/player/queue', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    let result = [];
    let source = 'queue';
    if (resp && resp.status === 200) {
      const data = resp.data || {};
      const items = Array.isArray(data.queue) ? data.queue : [];
      result = items.slice(0, 5).map(track => ({
        id: track.id,
        title: track.name,
        artist: (track.artists || []).map(a => a.name).join(', '),
        albumArt: track.album?.images?.[0]?.url,
        playlistName: 'Queue'
      }));
    }

    // Fallback/augment: if queue empty and we are in a playlist context, compute next tracks from playlist
    if (result.length === 0 && ctx?.type === 'playlist' && ctx.uri) {
      const playlistId = ctx.uri.split(':').pop();
      const next = await getNextFromPlaylist(spotifyApi, playlistId, currentUri, shuffle, 7);
      result = next.items;
      source = 'playlist';
    }

    return res.json({ items: result, shuffle, repeat, source, context: ctx?.type || null });
  } catch (error) {
    console.error('Error getting queue:', error);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// Lyrics API endpoint
app.get('/api/lyrics/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    
    // Get track info (title/artist) from Spotify
    const track = await spotifyApi.getTrack(trackId);
    const trackName = track.body.name;
    const artistName = track.body.artists?.[0]?.name || '';
    const albumName = track.body.album?.name || '';

    // Try LRCLIB for synced lyrics (free, public)
    const lrclibUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}&album_name=${encodeURIComponent(albumName)}`;
    const lr = await fetch(lrclibUrl);
    if (lr.ok) {
      const arr = await lr.json();
      const first = Array.isArray(arr) ? arr[0] : null;
      if (first && first.syncedLyrics) {
        const parsed = parseLrc(first.syncedLyrics);
        return res.json(parsed);
      }
      if (first && first.plainLyrics) {
        const unsynced = first.plainLyrics.split(/\r?\n/).filter(Boolean).map((text, i) => ({ text, startTime: i * 3 }));
        return res.json(unsynced);
      }
    }

    // Fallback to mock
    return res.json([
      { text: "Lyrics unavailable", startTime: 0 }
    ]);
  } catch (error) {
    console.error('Error getting lyrics:', error);
    res.status(500).json({ error: 'Failed to get lyrics' });
  }
});

// Spotify control endpoints
app.post('/api/play', async (req, res) => {
  try {
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    await spotifyApi.play();
    res.json({ success: true });
  } catch (error) {
    console.error('Error playing:', error);
    res.status(500).json({ error: 'Failed to play' });
  }
});

app.post('/api/pause', async (req, res) => {
  try {
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    await spotifyApi.pause();
    res.json({ success: true });
  } catch (error) {
    console.error('Error pausing:', error);
    res.status(500).json({ error: 'Failed to pause' });
  }
});

app.post('/api/skip-next', async (req, res) => {
  try {
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    await spotifyApi.skipToNext();
    res.json({ success: true });
  } catch (error) {
    console.error('Error skipping next:', error);
    res.status(500).json({ error: 'Failed to skip next' });
  }
});

app.post('/api/skip-previous', async (req, res) => {
  try {
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    await spotifyApi.skipToPrevious();
    res.json({ success: true });
  } catch (error) {
    console.error('Error skipping previous:', error);
    res.status(500).json({ error: 'Failed to skip previous' });
  }
});

app.post('/api/volume', async (req, res) => {
  try {
    const { volume } = req.body;
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    await spotifyApi.setVolume(volume);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting volume:', error);
    res.status(500).json({ error: 'Failed to set volume' });
  }
});

app.post('/api/seek', async (req, res) => {
  try {
    const { position } = req.body;
    const userId = 'default';
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    await spotifyApi.seek(position * 1000); // Convert to milliseconds
    res.json({ success: true });
  } catch (error) {
    console.error('Error seeking:', error);
    res.status(500).json({ error: 'Failed to seek' });
  }
});

// Helper functions
async function refreshAccessToken(userId, refreshToken) {
  try {
    spotifyApi.setRefreshToken(refreshToken);
    const data = await spotifyApi.refreshAccessToken();
    const { access_token, expires_in } = data.body;
    
    accessTokens.set(userId, {
      access_token,
      refresh_token: refreshToken,
      expires_in: Date.now() + expires_in * 1000
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    accessTokens.delete(userId);
  }
}

// LRC parser: converts "[mm:ss.xx] line" to { text, startTime }
function parseLrc(lrc) {
  const lines = lrc.split(/\r?\n/);
  const out = [];
  const timeTag = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/;
  for (const line of lines) {
    const m = timeTag.exec(line);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
    const startTime = min * 60 + sec + ms / 1000;
    const text = line.replace(timeTag, '').trim();
    if (text) out.push({ text, startTime });
  }
  // Ensure sorted by time
  out.sort((a, b) => a.startTime - b.startTime);
  return out;
}

// Helper to compute upcoming tracks from playlist respecting shuffle
async function getNextFromPlaylist(spotifyApi, playlistId, currentUri, shuffle, take = 3) {
  const plist = await spotifyApi.getPlaylist(playlistId);
  const all = (plist.body?.tracks?.items || [])
    .map(it => it.track)
    .filter(Boolean);
  const idx = all.findIndex(t => t?.uri === currentUri);
  let candidates = [];
  if (shuffle) {
    const rest = all.filter((t, i) => i !== idx);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    candidates = rest.slice(0, take);
  } else {
    candidates = all.slice(idx + 1, idx + 1 + take);
  }
  const items = candidates.map(track => ({
    id: track.id,
    title: track.name,
    artist: (track.artists || []).map(a => a.name).join(', '),
    albumArt: track.album?.images?.[0]?.url,
    playlistName: plist.body?.name || 'Playlist'
  }));
  return { items };
}

// Start server - bind to 0.0.0.0 for hosting platforms
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Spotiffy Backend running on port ${PORT} (host 0.0.0.0)`);
  console.log(`📡 Health: GET /health`);
});
