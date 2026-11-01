// Spotify Configuration
// Client credentials and PKCE auth config

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '9aaae8f6921b4ad3a5b068067d87c0ac';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://127.0.0.1:8888/callback';

module.exports = {
  SPOTIFY_CLIENT_ID: CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: CLIENT_SECRET,
  REDIRECT_URI,
  spotify: {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
  },

  playbackBackend: 'smtc', // 'smtc' or 'webapi'

  dock: {
    dynamic: true,
    autoHideDelay: 0,
    showTriggerDistance: 8,
  },

  ui: {
    theme: 'dark',
    animations: true,
    blurEffect: true,
  },
};
