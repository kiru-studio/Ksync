const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPlaybackBackend: () => ipcRenderer.invoke('get-playback-backend'),
  onSmtcPlayerState: (callback) => {
    const sub = (event, state) => callback(state);
    ipcRenderer.on('smtc-player-state', sub);
    return () => ipcRenderer.removeListener('smtc-player-state', sub);
  },
  smtcPlay: () => ipcRenderer.invoke('smtc-play'),
  smtcPause: () => ipcRenderer.invoke('smtc-pause'),
  smtcSkipNext: () => ipcRenderer.invoke('smtc-skip-next'),
  smtcSkipPrevious: () => ipcRenderer.invoke('smtc-skip-previous'),
  smtcSkipN: (count) => ipcRenderer.invoke('smtc-skip-n', count),
  smtcSkipPrevN: (count) => ipcRenderer.invoke('smtc-skip-prev-n', count),
  smtcSeek: (positionMs) => ipcRenderer.invoke('smtc-seek', positionMs),
  
  onDockVisibilityChange: (callback) => {
    const sub = (event, isVisible) => callback(isVisible);
    ipcRenderer.on('dock-visible', sub);
    return () => ipcRenderer.removeListener('dock-visible', sub);
  },
  getDockVisibility: () => ipcRenderer.invoke('get-dock-visibility'),
  isSettingsOpen: () => ipcRenderer.invoke('is-settings-open'),
  onSettingsWindowState: (callback) => {
    const sub = (event, state) => callback(state);
    ipcRenderer.on('settings-window-state', sub);
    return () => ipcRenderer.removeListener('settings-window-state', sub);
  },
  showDock: () => ipcRenderer.invoke('show-dock'),
  hideDock: (force) => ipcRenderer.invoke('hide-dock', force),
  onDockDimensions: (callback) => {
    const sub = (event, dimensions) => callback(dimensions);
    ipcRenderer.on('dock-dimensions', sub);
    return () => ipcRenderer.removeListener('dock-dimensions', sub);
  },
  onLyricsColorChanged: (callback) => {
    const sub = (event, color) => callback(color);
    ipcRenderer.on('lyrics-color-changed', sub);
    return () => ipcRenderer.removeListener('lyrics-color-changed', sub);
  },
  onMouseEnter: () => ipcRenderer.send('mouse-enter'),
  onMouseLeave: () => ipcRenderer.send('mouse-leave'),
  scrollHide: () => ipcRenderer.send('scroll-hide'),
  spotifyLogin: () => ipcRenderer.invoke('spotify-login'),
  spotifyHasTokens: () => ipcRenderer.invoke('spotify-has-tokens'),
  spotifyLogout: () => ipcRenderer.send('spotify-logout'),
  onSpotifyLoginDone: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('spotify-login-done', sub);
    return () => ipcRenderer.removeListener('spotify-login-done', sub);
  },
  onSpotifyLogoutDone: (callback) => {
    ipcRenderer.on('spotify-logout-done', () => callback());
  },
  spotifyGetPlayer: () => ipcRenderer.invoke('spotify-get-player'),
  spotifyGetQueue: (currentTrack) => ipcRenderer.invoke('spotify-get-queue', currentTrack),
  spotifyGetLyrics: (track) => ipcRenderer.invoke('spotify-get-lyrics', track),
  spotifyPlay: () => ipcRenderer.invoke('spotify-play'),
  spotifyPlayTrack: (uri) => ipcRenderer.invoke('spotify-play-track', uri),
  spotifyPause: () => ipcRenderer.invoke('spotify-pause'),
  spotifySkipNext: () => ipcRenderer.invoke('spotify-skip-next'),
  spotifySkipPrevious: () => ipcRenderer.invoke('spotify-skip-previous'),
  spotifySetVolume: (volume) => ipcRenderer.invoke('spotify-set-volume', volume),
  spotifySeek: (positionMs) => ipcRenderer.invoke('spotify-seek', positionMs),
  spotifySetShuffle: (state) => ipcRenderer.invoke('spotify-set-shuffle', state),
  spotifySetRepeat: (state) => ipcRenderer.invoke('spotify-set-repeat', state),
  spotifyGetCurrentUser: () => ipcRenderer.invoke('spotify-get-current-user'),
  spotifyGetDevices: () => ipcRenderer.invoke('spotify-get-devices'),
  spotifyTransferPlayback: (deviceIds, play) =>
    ipcRenderer.invoke('spotify-transfer-playback', deviceIds, play),
  spotifyCheckSavedTracks: (payload) => ipcRenderer.invoke('spotify-check-saved-tracks', payload),
  spotifySaveTrack: (payload) => ipcRenderer.invoke('spotify-save-track', payload),
  spotifyRemoveTrack: (payload) => ipcRenderer.invoke('spotify-remove-track', payload),
  spotifyGetAudioFeatures: (payload) => ipcRenderer.invoke('spotify-get-audio-features', payload),

  // Settings & Configuration APIs
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings-changed', (event, s) => callback(s));
  },
  saveExtractedAccent: (accent) => ipcRenderer.send('save-extracted-accent', accent),
  onExtractedAccentSync: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('extracted-accent-sync', sub);
    return () => ipcRenderer.removeListener('extracted-accent-sync', sub);
  },
  togglePin: () => ipcRenderer.invoke('toggle-pin'),
  setDockHeight: (height) => ipcRenderer.invoke('set-dock-height', height),
  setSidebarWidth: (width) => ipcRenderer.invoke('set-sidebar-width', width),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings'),
  minimizeSettingsWindow: () => ipcRenderer.invoke('minimize-settings'),
  getDockDimensions: () => ipcRenderer.invoke('get-dock-dimensions'),
  openSpotifyApp: () => ipcRenderer.invoke('open-spotify-app'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),

  // Windows System Master Audio Volume APIs
  getSystemVolume: () => ipcRenderer.invoke('get-system-volume'),
  setSystemVolume: (volume) => ipcRenderer.invoke('set-system-volume', volume),
  setSystemMute: (isMuted) => ipcRenderer.invoke('set-system-mute', isMuted),
  getSpotifyVolume: () => ipcRenderer.invoke('get-spotify-volume'),
  onSpotifyVolumeChanged: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('spotify-volume-changed', sub);
    return () => ipcRenderer.removeListener('spotify-volume-changed', sub);
  },
  onSystemVolumeChanged: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('system-volume-changed', sub);
    return () => ipcRenderer.removeListener('system-volume-changed', sub);
  },

  // OTA Auto-Update APIs
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  getLoginItemSettings: () => ipcRenderer.invoke('get-login-item-settings'),
  setLoginItemSettings: (openAtLogin) => ipcRenderer.invoke('set-login-item-settings', openAtLogin),

  // Windows 11 Native Integration & Discord RPC
  getAllDisplays: () => ipcRenderer.invoke('get-all-displays'),
  toggleCompactMode: () => ipcRenderer.invoke('toggle-compact-mode'),
  getCompactMode: () => ipcRenderer.invoke('get-compact-mode'),
  onCompactModeChanged: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('compact-mode-changed', sub);
    return () => ipcRenderer.removeListener('compact-mode-changed', sub);
  },
  updateDiscordRPC: (trackInfo) => ipcRenderer.invoke('update-discord-rpc', trackInfo),
  triggerTrackPeek: (trackData) => ipcRenderer.invoke('trigger-track-peek', trackData),
  dismissTrackPeek: () => ipcRenderer.invoke('dismiss-track-peek'),
  getCurrentPeekData: () => ipcRenderer.invoke('get-current-peek-data'),
  onTrackPeekData: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('track-peek-data', sub);
    return () => ipcRenderer.removeListener('track-peek-data', sub);
  },
  onDeepSleepMode: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('deep-sleep-mode', sub);
    return () => ipcRenderer.removeListener('deep-sleep-mode', sub);
  },
  wakeFromDeepSleep: () => ipcRenderer.invoke('wake-from-deep-sleep'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  onUpdateStatus: (callback) => {
    const sub = (event, status) => callback(status);
    ipcRenderer.on('update-status', sub);
    return () => ipcRenderer.removeListener('update-status', sub);
  },
});
