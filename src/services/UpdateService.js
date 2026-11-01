const { autoUpdater } = require('electron-updater');
const { app } = require('electron');

class UpdateService {
  constructor() {
    this.status = {
      state: 'idle', // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
      version: null,
      currentVersion: app.getVersion(),
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
      releaseNotes: null,
      releaseDate: null,
      error: null,
      lastChecked: null,
    };

    this.getWindows = null;
    this.onTrayUpdate = null;
    this.isManualCheck = false;
  }

  init(getWindows, onTrayUpdate) {
    this.getWindows = getWindows;
    this.onTrayUpdate = onTrayUpdate;

    // Configure autoUpdater
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    // Use built-in logging
    autoUpdater.logger = {
      info: (...args) => console.log('[AutoUpdater]', ...args),
      warn: (...args) => console.warn('[AutoUpdater]', ...args),
      error: (...args) => console.error('[AutoUpdater]', ...args),
    };

    this.setupListeners();

    // Silently check for updates 8 seconds after app launch
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 8000);

    // Periodically check every 2 hours
    setInterval(() => {
      this.checkForUpdates(false);
    }, 2 * 60 * 60 * 1000);
  }

  setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates against GitHub Releases...');
      this.updateState({
        state: 'checking',
        error: null,
      });
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] Update available:', info.version);
      this.updateState({
        state: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
        percent: 0,
        error: null,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AutoUpdater] App is up to date:', info.version || this.status.currentVersion);
      this.updateState({
        state: 'not-available',
        version: info.version || this.status.currentVersion,
        lastChecked: Date.now(),
        error: null,
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const pct = Math.round(progressObj.percent || 0);
      console.log(`[AutoUpdater] Download progress: ${pct}%`);
      this.updateState({
        state: 'downloading',
        percent: pct,
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Update downloaded successfully:', info.version);
      this.updateState({
        state: 'downloaded',
        version: info.version,
        percent: 100,
        error: null,
      });
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] Update check/download failed:', err.message);
      this.updateState({
        state: 'error',
        error: err.message || 'Check failed',
        lastChecked: Date.now(),
      });
    });
  }

  updateState(partial) {
    this.status = { ...this.status, ...partial };

    // Broadcast to renderer windows
    if (this.getWindows) {
      const windows = this.getWindows();
      windows.forEach((win) => {
        if (win && !win.isDestroyed() && win.webContents) {
          win.webContents.send('update-status', this.status);
        }
      });
    }

    // Refresh tray menu
    if (this.onTrayUpdate) {
      try {
        this.onTrayUpdate();
      } catch (_) {}
    }
  }

  async checkForUpdates(manual = false) {
    this.isManualCheck = manual;
    try {
      this.updateState({ state: 'checking', error: null });
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      console.warn('[AutoUpdater] Manual check error:', err.message);
      this.updateState({
        state: 'error',
        error: err.message || 'Unable to connect to update server',
      });
      return null;
    }
  }

  async downloadUpdate() {
    try {
      this.updateState({ state: 'downloading', percent: 0 });
      return await autoUpdater.downloadUpdate();
    } catch (err) {
      console.error('[AutoUpdater] Download failed:', err.message);
      this.updateState({ state: 'error', error: err.message });
      return null;
    }
  }

  quitAndInstall() {
    console.log('[AutoUpdater] Quitting and installing update now...');
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      console.error('[AutoUpdater] quitAndInstall error:', err);
    }
  }

  getStatus() {
    return this.status;
  }
}

module.exports = new UpdateService();
