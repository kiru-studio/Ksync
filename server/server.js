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
    
    const [currentTrack, queue] = await Promise.all([
      spotifyApi.getMyCurrentPlaybackState(),
      spotifyApi.getMyCurrentPlaybackState()
    ]);

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
        isPlaying: currentTrack.body.is_playing,
        volume: currentTrack.body.device?.volume_percent || 50
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
    const tokens = accessTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    spotifyApi.setAccessToken(tokens.access_token);
    const queue = await spotifyApi.getMyCurrentPlaybackState();
    
    if (queue.body && queue.body.queue) {
      const queueItems = queue.body.queue.slice(0, 5).map(track => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        albumArt: track.album.images[0]?.url,
        playlistName: 'Queue'
      }));
      res.json(queueItems);
    } else {
      res.json([]);
    }
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
    
    // Get track info
    const track = await spotifyApi.getTrack(trackId);
    const trackName = track.body.name;
    const artistName = track.body.artists[0].name;
    
    // Fetch lyrics from Genius (you can replace with other services)
    const lyrics = await fetchLyricsFromGenius(trackName, artistName);
    
    res.json(lyrics);
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

async function fetchLyricsFromGenius(trackName, artistName) {
  try {
    // This is a simplified example - you might want to use a proper lyrics API
    // For now, we'll return mock lyrics
    return [
      { text: "I'd be your last love, everlasting, you and me", startTime: 0 },
      { text: "Mm, that was what you told me", startTime: 4 },
      { text: "I'm giving you up", startTime: 8 },
      { text: "But I'm still holding on", startTime: 12 },
      { text: "To the memories we made", startTime: 16 },
      { text: "And the promises we kept", startTime: 20 }
    ];
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    return [];
  }
}

// Start server - bind to 0.0.0.0 for hosting platforms
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Spotiffy Backend running on port ${PORT} (host 0.0.0.0)`);
  console.log(`📡 Health: GET /health`);
});
