import React, { useState } from 'react';
import {
  X,
  Palette,
  Layout,
  Compass,
  User,
  Pin,
  Sparkles,
  Volume2,
  ExternalLink,
  LogOut,
  LogIn,
  RotateCcw,
  Check,
  Laptop,
  Smartphone,
  Tv,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const QUICK_SWATCHES = [
  '#0c0e14',
  '#000000',
  '#111827',
  '#1e1b4b',
  '#180828',
  '#2a0808',
  '#062419',
];

const ACCENT_SWATCHES = [
  '#1db954',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#eab308',
];

export default function SettingsDrawer({
  isOpen,
  onClose,
  user,
  isAuthenticated,
  onLogin,
  onLogout,
  devices = [],
  currentDeviceId,
  onDeviceChange,
  playbackBackend = 'smtc',
}) {
  const [activeTab, setActiveTab] = useState('appearance');
  const { settings, updateSettings, resetSettings, togglePin, setDockHeight, applyPreset, presets } =
    useSettings();

  if (!isOpen) return null;

  const theming = settings.theming || {};
  const position = settings.position || {};
  const layout = settings.layout || {};
  const behavior = settings.behavior || {};

  const handlePanelToggle = (panelKey) => {
    const current = layout[panelKey];
    // Prevent unchecking all panels (at least one must stay active)
    const activeCount =
      (layout.showNowPlaying ? 1 : 0) +
      (layout.showLyrics ? 1 : 0) +
      (layout.showQueue ? 1 : 0);
    if (current && activeCount <= 1) return;

    updateSettings({
      layout: {
        [panelKey]: !current,
      },
    });
  };

  const handleOrderChange = (orderArray) => {
    updateSettings({
      layout: {
        panelOrder: orderArray,
      },
    });
  };

  return (
    <div className="settings-drawer-backdrop" onClick={onClose}>
      <div
        className="settings-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="ksync Settings"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-brand-badge">ksync</span>
            <h2 className="drawer-title">Configurator & Preferences</h2>
          </div>
          <div className="drawer-header-actions">
            <button
              type="button"
              className="drawer-icon-btn"
              onClick={resetSettings}
              title="Reset all settings to defaults"
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={onClose}
              title="Close settings"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="drawer-tabs">
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Palette size={15} />
            <span>Appearance</span>
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'layout' ? 'active' : ''}`}
            onClick={() => setActiveTab('layout')}
          >
            <Layout size={15} />
            <span>Layout</span>
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'position' ? 'active' : ''}`}
            onClick={() => setActiveTab('position')}
          >
            <Compass size={15} />
            <span>Position</span>
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <User size={15} />
            <span>Account</span>
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="drawer-body">
          {/* TAB 1: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="drawer-section-group">
              {/* Presets Gallery */}
              <div className="drawer-section">
                <label className="section-label">
                  <Sparkles size={14} /> Theme Presets
                </label>
                <div className="preset-grid">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-card ${theming.preset === preset.id ? 'active' : ''}`}
                      onClick={() => applyPreset(preset.id)}
                    >
                      <div
                        className="preset-preview-pill"
                        style={{
                          background:
                            preset.backdropStyle === 'gradient'
                              ? `linear-gradient(${preset.gradient.angle}deg, ${preset.gradient.color1}, ${preset.gradient.color2})`
                              : preset.solidColor,
                          border: `2px solid ${preset.accentColor}`,
                        }}
                      />
                      <span className="preset-name">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Backdrop Style */}
              <div className="drawer-section">
                <label className="section-label">Backdrop Style</label>
                <div className="segmented-control">
                  {[
                    { id: 'acrylic', label: 'Acrylic Glass' },
                    { id: 'solid', label: 'Solid Color' },
                    { id: 'gradient', label: 'Gradient' },
                    { id: 'artwork', label: 'Album Art' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={`segment-btn ${theming.backdropStyle === style.id ? 'active' : ''}`}
                      onClick={() =>
                        updateSettings({
                          theming: { backdropStyle: style.id, preset: 'custom' },
                        })
                      }
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solid Color Config */}
              {theming.backdropStyle === 'solid' && (
                <div className="drawer-section subsection">
                  <label className="section-label">Solid Color</label>
                  <div className="color-swatch-row">
                    {QUICK_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className="swatch-btn"
                        style={{ backgroundColor: hex }}
                        onClick={() =>
                          updateSettings({
                            theming: { solidColor: hex, preset: 'custom' },
                          })
                        }
                      />
                    ))}
                    <input
                      type="color"
                      className="color-picker-input"
                      value={theming.solidColor || '#0c0e14'}
                      onChange={(e) =>
                        updateSettings({
                          theming: { solidColor: e.target.value, preset: 'custom' },
                        })
                      }
                      title="Custom color picker"
                    />
                  </div>
                </div>
              )}

              {/* Gradient Config */}
              {theming.backdropStyle === 'gradient' && (
                <div className="drawer-section subsection">
                  <label className="section-label">Dual-Tone Gradient</label>
                  <div className="gradient-controls-row">
                    <div className="gradient-color-pick">
                      <span>Color 1</span>
                      <input
                        type="color"
                        className="color-picker-input"
                        value={theming.gradient?.color1 || '#181b29'}
                        onChange={(e) =>
                          updateSettings({
                            theming: {
                              gradient: { color1: e.target.value },
                              preset: 'custom',
                            },
                          })
                        }
                      />
                    </div>
                    <div className="gradient-color-pick">
                      <span>Color 2</span>
                      <input
                        type="color"
                        className="color-picker-input"
                        value={theming.gradient?.color2 || '#0b0c13'}
                        onChange={(e) =>
                          updateSettings({
                            theming: {
                              gradient: { color2: e.target.value },
                              preset: 'custom',
                            },
                          })
                        }
                      />
                    </div>
                    <div className="gradient-angle-pick">
                      <span>Angle: {theming.gradient?.angle || 135}°</span>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="15"
                        value={theming.gradient?.angle || 135}
                        onChange={(e) =>
                          updateSettings({
                            theming: {
                              gradient: { angle: Number(e.target.value) },
                              preset: 'custom',
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Opacity & Blur Sliders */}
              <div className="drawer-section">
                <div className="slider-row">
                  <div className="slider-label-group">
                    <span>Backdrop Opacity</span>
                    <span className="slider-value">
                      {Math.round((theming.opacity ?? 0.92) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.15"
                    max="1.0"
                    step="0.02"
                    value={theming.opacity ?? 0.92}
                    onChange={(e) =>
                      updateSettings({
                        theming: { opacity: Number(e.target.value), preset: 'custom' },
                      })
                    }
                  />
                </div>

                <div className="slider-row">
                  <div className="slider-label-group">
                    <span>Frosted Glass Blur</span>
                    <span className="slider-value">{theming.blurStrength ?? 24}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="2"
                    value={theming.blurStrength ?? 24}
                    onChange={(e) =>
                      updateSettings({
                        theming: { blurStrength: Number(e.target.value), preset: 'custom' },
                      })
                    }
                  />
                </div>
              </div>

              {/* Text & Lyric Accent Colors */}
              <div className="drawer-section">
                <label className="section-label">Active Lyric Glow Color</label>
                <div className="color-swatch-row">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className="swatch-btn"
                      style={{ backgroundColor: hex }}
                      onClick={() =>
                        updateSettings({
                          theming: { lyricsActiveColor: hex, preset: 'custom' },
                        })
                      }
                    />
                  ))}
                  <input
                    type="color"
                    className="color-picker-input"
                    value={theming.lyricsActiveColor && theming.lyricsActiveColor.startsWith('#') ? theming.lyricsActiveColor : '#38bdf8'}
                    onChange={(e) =>
                      updateSettings({
                        theming: { lyricsActiveColor: e.target.value, preset: 'custom' },
                      })
                    }
                    title="Pick custom lyric accent color"
                  />
                </div>

                <div className="toggle-row" style={{ marginTop: '12px' }}>
                  <label className="toggle-label-text">Lyrics Dimming Mode</label>
                  <div className="segmented-control mini">
                    <button
                      type="button"
                      className={`segment-btn ${theming.lyricsColor !== 'black' ? 'active' : ''}`}
                      onClick={() => updateSettings({ theming: { lyricsColor: 'white' } })}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${theming.lyricsColor === 'black' ? 'active' : ''}`}
                      onClick={() => updateSettings({ theming: { lyricsColor: 'black' } })}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LAYOUT */}
          {activeTab === 'layout' && (
            <div className="drawer-section-group">
              {/* Panel Visibility Toggles */}
              <div className="drawer-section">
                <label className="section-label">Visible Modules</label>
                <p className="section-description">
                  Customize which panels are shown. Hide modules to create a wide
                  Lyrics-Only display or Now Playing focus.
                </p>

                <div className="module-toggle-list">
                  <label className="module-checkbox-card">
                    <input
                      type="checkbox"
                      checked={!!layout.showNowPlaying}
                      onChange={() => handlePanelToggle('showNowPlaying')}
                    />
                    <div className="module-card-info">
                      <span className="module-card-title">Now Playing Panel</span>
                      <span className="module-card-desc">
                        Album art, track title, controls, progress & volume
                      </span>
                    </div>
                  </label>

                  <label className="module-checkbox-card">
                    <input
                      type="checkbox"
                      checked={!!layout.showLyrics}
                      onChange={() => handlePanelToggle('showLyrics')}
                    />
                    <div className="module-card-info">
                      <span className="module-card-title">Synced Lyrics Panel</span>
                      <span className="module-card-desc">
                        Karaoke-style synchronized lyrics with timeline seeking
                      </span>
                    </div>
                  </label>

                  <label className="module-checkbox-card">
                    <input
                      type="checkbox"
                      checked={!!layout.showQueue}
                      onChange={() => handlePanelToggle('showQueue')}
                    />
                    <div className="module-card-info">
                      <span className="module-card-title">Up Next Queue Panel</span>
                      <span className="module-card-desc">
                        Upcoming playlist & album tracks with 1-click play
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Panel Order */}
              <div className="drawer-section">
                <label className="section-label">Panel Order Sequence</label>
                <div className="order-preset-buttons">
                  <button
                    type="button"
                    className={`order-chip ${
                      JSON.stringify(layout.panelOrder) ===
                      JSON.stringify(['nowPlaying', 'lyrics', 'queue'])
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      handleOrderChange(['nowPlaying', 'lyrics', 'queue'])
                    }
                  >
                    [ Now Playing | Lyrics | Queue ]
                  </button>
                  <button
                    type="button"
                    className={`order-chip ${
                      JSON.stringify(layout.panelOrder) ===
                      JSON.stringify(['lyrics', 'nowPlaying', 'queue'])
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      handleOrderChange(['lyrics', 'nowPlaying', 'queue'])
                    }
                  >
                    [ Lyrics | Now Playing | Queue ]
                  </button>
                  <button
                    type="button"
                    className={`order-chip ${
                      JSON.stringify(layout.panelOrder) ===
                      JSON.stringify(['queue', 'nowPlaying', 'lyrics'])
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      handleOrderChange(['queue', 'nowPlaying', 'lyrics'])
                    }
                  >
                    [ Queue | Now Playing | Lyrics ]
                  </button>
                </div>
              </div>

              {/* Dock Width Style: Full Edge vs Island */}
              <div className="drawer-section">
                <label className="section-label">Dock Width Mode</label>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segment-btn ${position.style !== 'island' ? 'active' : ''}`}
                    onClick={() => updateSettings({ position: { style: 'full' } })}
                  >
                    Full Screen Width
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${position.style === 'island' ? 'active' : ''}`}
                    onClick={() => updateSettings({ position: { style: 'island' } })}
                  >
                    Floating Island / Pill
                  </button>
                </div>

                {position.style === 'island' && (
                  <div className="slider-row" style={{ marginTop: '14px' }}>
                    <div className="slider-label-group">
                      <span>Island Width</span>
                      <span className="slider-value">{position.islandWidth || 1180}px</span>
                    </div>
                    <input
                      type="range"
                      min="850"
                      max="1650"
                      step="25"
                      value={position.islandWidth || 1180}
                      onChange={(e) =>
                        updateSettings({
                          position: { islandWidth: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Dock Height Slider */}
              <div className="drawer-section">
                <div className="slider-row">
                  <div className="slider-label-group">
                    <span>Top Dock Height</span>
                    <span className="slider-value">{position.height || 190}px</span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="280"
                    step="5"
                    value={position.height || 190}
                    onChange={(e) => setDockHeight(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POSITION & BEHAVIOR */}
          {activeTab === 'position' && (
            <div className="drawer-section-group">
              {/* Screen Edge Placement */}
              <div className="drawer-section">
                <label className="section-label">Screen Edge Placement</label>
                <div className="position-card-grid">
                  {[
                    { id: 'left', title: 'Left Sidebar', desc: 'Vertical stack sliding in from left edge' },
                    { id: 'top', title: 'Top Bar Dock', desc: 'Slides down from the top screen edge' },
                    { id: 'right', title: 'Right Sidebar', desc: 'Vertical stack sliding in from right edge' },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      className={`position-card ${(position.mode || 'top') === pos.id ? 'active' : ''}`}
                      onClick={() => updateSettings({ position: { mode: pos.id } })}
                    >
                      <div className="position-card-header">
                        <span className="position-card-title">{pos.title}</span>
                        {(position.mode || 'top') === pos.id && <Check size={14} color="#1db954" />}
                      </div>
                      <span className="position-card-desc">{pos.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pin Mode */}
              <div className="drawer-section">
                <div className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-title-line">
                      <Pin size={14} />
                      <span className="toggle-title">Pin Dock (Always Visible)</span>
                    </div>
                    <span className="toggle-desc">
                      Disables auto-hide so ksync stays open permanently on your desktop
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`switch-btn ${position.pinned ? 'on' : 'off'}`}
                    onClick={togglePin}
                  >
                    <span className="switch-knob" />
                  </button>
                </div>
              </div>

              {/* Behavior & Gestures */}
              <div className="drawer-section">
                <label className="section-label">Mouse Gestures & Controls</label>
                <div className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-title-line">
                      <Volume2 size={14} />
                      <span className="toggle-title">Mouse Wheel Volume</span>
                    </div>
                    <span className="toggle-desc">
                      Scroll mouse wheel over empty dock area to adjust volume
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`switch-btn ${behavior.mouseWheelVolume !== false ? 'on' : 'off'}`}
                    onClick={() =>
                      updateSettings({
                        behavior: { mouseWheelVolume: !behavior.mouseWheelVolume },
                      })
                    }
                  >
                    <span className="switch-knob" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="drawer-section-group">
              {/* Profile Card */}
              <div className="drawer-section">
                <label className="section-label">Spotify Account Status</label>
                {isAuthenticated && user ? (
                  <div className="account-profile-card">
                    <div className="account-avatar-wrapper">
                      {user.images?.[0]?.url ? (
                        <img src={user.images[0].url} alt="" className="account-avatar-img" />
                      ) : (
                        <div className="account-avatar-placeholder">👤</div>
                      )}
                    </div>
                    <div className="account-details">
                      <div className="account-name-row">
                        <span className="account-display-name">
                          {user.display_name || 'Spotify User'}
                        </span>
                        <span className="account-product-badge">
                          {user.product === 'premium' ? 'Spotify Premium' : 'Free Account'}
                        </span>
                      </div>
                      <span className="account-email">{user.email || 'Connected via PKCE OAuth'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="account-disconnected-card">
                    <p>Not connected to Spotify. Connect your account to enable live queue, lyrics and controls.</p>
                    <button
                      type="button"
                      className="connect-spotify-primary-btn"
                      onClick={() => {
                        onClose();
                        onLogin();
                      }}
                    >
                      <LogIn size={15} />
                      <span>Connect with Spotify</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Playback Backend Info */}
              <div className="drawer-section">
                <label className="section-label">Playback Backend</label>
                <div className="backend-info-chip">
                  <span className="backend-name">
                    {playbackBackend === 'smtc'
                      ? 'Windows System Media Transport Controls (SMTC)'
                      : 'Spotify Web API'}
                  </span>
                  <span className="backend-status-tag">Active</span>
                </div>
                <p className="section-description" style={{ marginTop: '6px' }}>
                  {playbackBackend === 'smtc'
                    ? 'Allows local playback control and track sync on Free accounts without Spotify Premium restrictions.'
                    : 'Direct cloud Web API connection.'}
                </p>
              </div>

              {/* Devices Switcher */}
              {isAuthenticated && devices.length > 0 && (
                <div className="drawer-section">
                  <label className="section-label">Active Spotify Connect Device</label>
                  <div className="device-select-list">
                    {devices.map((device) => {
                      const isCurrent = device.id === currentDeviceId || device.is_active;
                      const IconComponent =
                        device.type === 'Smartphone'
                          ? Smartphone
                          : device.type === 'TV'
                          ? Tv
                          : Laptop;
                      return (
                        <button
                          key={device.id}
                          type="button"
                          className={`device-card-item ${isCurrent ? 'active' : ''}`}
                          onClick={() => onDeviceChange && onDeviceChange(device.id)}
                        >
                          <IconComponent size={16} />
                          <div className="device-info">
                            <span className="device-name">{device.name}</span>
                            <span className="device-type">
                              {device.type} {isCurrent ? '· Active' : ''}
                            </span>
                          </div>
                          {isCurrent && <Check size={14} color="#1db954" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Account Actions */}
              <div className="drawer-section">
                <label className="section-label">Quick Actions</label>
                <div className="account-actions-row">
                  <button
                    type="button"
                    className="action-pill-btn"
                    onClick={() => window.electronAPI?.openSpotifyApp && window.electronAPI.openSpotifyApp()}
                  >
                    <ExternalLink size={14} />
                    <span>Launch Spotify App</span>
                  </button>

                  {isAuthenticated && (
                    <button
                      type="button"
                      className="action-pill-btn danger"
                      onClick={() => {
                        onClose();
                        onLogout();
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sign Out & Disconnect</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

