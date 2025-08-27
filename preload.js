const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onDockVisibilityChange: (callback) => {
    ipcRenderer.on('dock-visible', (event, isVisible) => callback(isVisible));
  },
  onMouseEnter: () => ipcRenderer.send('mouse-enter'),
  onMouseLeave: () => ipcRenderer.send('mouse-leave'),
});
