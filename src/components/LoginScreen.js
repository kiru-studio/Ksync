import React from 'react';
import { LogIn } from 'lucide-react';
import kLogo from '../../assets/k-logo-white.png';

function LoginScreen({ onLogin, error }) {
  return (
    <div className="login-bar-compact">
      <div className="login-brand">
        <div className="brand-icon">
          <img src={kLogo} alt="ksync" className="brand-k-logo" />
        </div>
        <div className="brand-info">
          <span className="brand-title">ksync</span>
          <span className="brand-desc">Spotify Floating Dock</span>
        </div>
      </div>

      <div className="login-message">
        {error ? (
          <span className="login-error-text">{error}</span>
        ) : (
          <span>Play music on Spotify Desktop or connect your Spotify account</span>
        )}
      </div>

      <button type="button" className="login-action-btn" onClick={onLogin}>
        <LogIn size={15} />
        <span>Connect Spotify</span>
      </button>
    </div>
  );
}

export default LoginScreen;
