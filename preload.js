const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onDockVisibilityChange: (callback) => {
    ipcRenderer.on('dock-visible', (event, isVisible) => callback(isVisible));
  },
  onDockDimensions: (callback) => {
    ipcRenderer.on('dock-dimensions', (event, dimensions) => callback(dimensions));
  },
  onLyricsColorChanged: (callback) => {
    ipcRenderer.on('lyrics-color-changed', (event, color) => callback(color));
  },
  onMouseEnter: () => ipcRenderer.send('mouse-enter'),
  onMouseLeave: () => ipcRenderer.send('mouse-leave'),
  spotifyLogin: () => ipcRenderer.invoke('spotify-login'),
  spotifyHasTokens: () => ipcRenderer.invoke('spotify-has-tokens'),
  spotifyLogout: () => ipcRenderer.send('spotify-logout'),
  onSpotifyLogoutDone: (callback) => {
    ipcRenderer.on('spotify-logout-done', () => callback());
  },
  spotifyGetPlayer: () => ipcRenderer.invoke('spotify-get-player'),
  spotifyGetQueue: () => ipcRenderer.invoke('spotify-get-queue'),
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
});
