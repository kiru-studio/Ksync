const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const UPDATE_CONFIG_YAML = [
  'owner: kiru-studio',
  'repo: Ksync',
  'provider: github',
  'updaterCacheDirName: ksync-updater',
  'publisherName:',
  '  - kiru studio',
  '',
].join('\n');

/**
 * Ensures app-update.yml is present on disk so electron-updater never fails
 * with ENOENT on portable or unpacked distributions.
 */
function ensureUpdateConfigFile() {
  // 1. Check/write in process.resourcesPath (standard electron resources directory)
  try {
    if (process.resourcesPath) {
      const standardPath = path.join(process.resourcesPath, 'app-update.yml');
      if (fs.existsSync(standardPath)) {
        return standardPath;
      }
      if (fs.existsSync(process.resourcesPath)) {
        fs.writeFileSync(standardPath, UPDATE_CONFIG_YAML, 'utf8');
        console.log('[AutoUpdater] Created fallback app-update.yml in resourcesPath:', standardPath);
        return standardPath;
      }
    }
  } catch (err) {
    console.warn('[AutoUpdater] Could not write to resourcesPath:', err.message);
  }

  // 2. Fallback to app userData if resourcesPath is read-only
  try {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    const fallbackPath = path.join(userData, 'app-update.yml');
    if (!fs.existsSync(fallbackPath)) {
      fs.writeFileSync(fallbackPath, UPDATE_CONFIG_YAML, 'utf8');
      console.log('[AutoUpdater] Created fallback app-update.yml in userData:', fallbackPath);
    }
    return fallbackPath;
  } catch (err) {
    console.warn('[AutoUpdater] Could not write to userData:', err.message);
  }

  return null;
}

class UpdateService {
  constructor() {
    const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);

    this.isPortable = isPortable;
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
      isPortable,
    };

    this.getWindows = null;
    this.onTrayUpdate = null;
    this.isManualCheck = false;
  }

  init(getWindows, onTrayUpdate) {
    this.getWindows = getWindows;
    this.onTrayUpdate = onTrayUpdate;

    // Ensure app-update.yml exists before autoUpdater accesses it
    const configPath = ensureUpdateConfigFile();
    if (configPath) {
      try {
        autoUpdater.appUpdateConfigPath = configPath;
      } catch (err) {
        console.warn('[AutoUpdater] Could not set appUpdateConfigPath:', err.message);
      }
    }

    // Explicitly set feed provider options as well
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'kiru-studio',
        repo: 'Ksync',
      });
    } catch (err) {
      console.warn('[AutoUpdater] setFeedURL error:', err.message);
    }

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

    // Silently check for updates 8 seconds after app launch (only if packaged)
    setTimeout(() => {
      if (app.isPackaged) {
        this.checkForUpdates(false);
      }
    }, 8000);

    // Periodically check every 2 hours
    setInterval(() => {
      if (app.isPackaged) {
        this.checkForUpdates(false);
      }
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
    this.updateState({ state: 'checking', error: null });

    // Handle development mode cleanly
    if (!app.isPackaged) {
      console.log('[AutoUpdater] App is not packaged, returning current version as up to date');
      setTimeout(() => {
        this.updateState({
          state: 'not-available',
          version: this.status.currentVersion,
          lastChecked: Date.now(),
          error: null,
        });
      }, 500);
      return null;
    }

    try {
      // Ensure config file exists right before checking
      const configPath = ensureUpdateConfigFile();
      if (configPath && autoUpdater.appUpdateConfigPath !== configPath) {
        autoUpdater.appUpdateConfigPath = configPath;
      }
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      console.warn('[AutoUpdater] Check error:', err.message);
      this.updateState({
        state: 'error',
        error: err.message || 'Unable to connect to update server',
        lastChecked: Date.now(),
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
