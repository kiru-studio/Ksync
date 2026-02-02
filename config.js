// Spotify Configuration (PKCE - no client secret needed)
// Get your Client ID from https://developer.spotify.com/dashboard
//
// IMPORTANT – Fix "Invalid redirect URI":
// 1. Open https://developer.spotify.com/dashboard and select your app (or create one).
// 2. Click "Settings" and scroll to "Redirect URIs".
// 3. Add exactly: http://127.0.0.1:8888/callback
//    (no trailing slash, 127.0.0.1 not localhost, port 8888, path /callback)
// 4. Click "Add" then "Save".
//
// If you get "403 Forbidden": Your app is in Development Mode. Add your Spotify
// account in the Dashboard: Settings > User Management > Add your email.

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '9aaae8f6921b4ad3a5b068067d87c0ac';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://127.0.0.1:8888/callback';

module.exports = {
  SPOTIFY_CLIENT_ID: CLIENT_ID,
  REDIRECT_URI,
  spotify: {
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  },

  dock: {
    height: 450,
    autoHideDelay: 300,
    showTriggerDistance: 5,
    hideTriggerDistance: 120,
  },

  ui: {
    theme: 'dark',
    animations: true,
    blurEffect: true,
  },
};
