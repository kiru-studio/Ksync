import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SettingsApp from './components/SettingsApp';
import DynamicIslandPeek from './components/DynamicIslandPeek';
import { SettingsProvider } from './context/SettingsContext';
import './styles.css';

function Root() {
  const [currentHash, setCurrentHash] = useState(() => {
    return typeof window !== 'undefined' ? window.location.hash : '';
  });

  useEffect(() => {
    const handleHash = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (currentHash === '#settings') {
    return (
      <SettingsProvider>
        <SettingsApp />
      </SettingsProvider>
    );
  }

  if (currentHash === '#peek') {
    return <DynamicIslandPeek />;
  }

  return (
    <SettingsProvider>
      <App />
    </SettingsProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
