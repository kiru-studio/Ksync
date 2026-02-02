import React from 'react';

function LoginScreen({ onLogin, error }) {
  return (
    <div className="login-panel">
      <h1 className="login-title">Spotiffy Dock</h1>
      <p className="login-subtitle">Connect to Spotify to control playback, view lyrics, and see your queue.</p>
      {error && <p className="login-error">{error}</p>}
      <button type="button" className="login-button" onClick={onLogin}>
        Connect with Spotify
      </button>
      <p className="login-hint">
        Add your Spotify Client ID in config.js. Redirect URI: http://127.0.0.1:8888/callback
      </p>
    </div>
  );
}

export default LoginScreen;
