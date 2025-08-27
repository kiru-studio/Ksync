// Spotify Configuration
// Replace these values with your own from the Spotify Developer Dashboard

const config = {
  spotify: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID', // Get this from https://developer.spotify.com/dashboard
    redirectUri: 'http://localhost:3000/callback',
    scopes: [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'user-read-playback-position',
      'user-read-volume',
      'playlist-read-private',
      'playlist-read-collaborative'
    ]
  },
  
  // Dock Configuration
  dock: {
    height: 120, // Height of the dock in pixels
    autoHideDelay: 300, // Delay before auto-hiding (ms)
    showTriggerDistance: 5, // Distance from top edge to trigger show (px)
    hideTriggerDistance: 120 // Distance from top edge to trigger hide (px)
  },
  
  // UI Configuration
  ui: {
    theme: 'dark', // 'dark' or 'light'
    animations: true, // Enable/disable animations
    blurEffect: true // Enable/disable backdrop blur
  }
};

module.exports = config;
