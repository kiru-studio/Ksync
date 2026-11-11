const { app, BrowserWindow, screen, ipcMain, Tray, nativeImage, Menu, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

if (!app) {
  console.log('[ksync] Please launch with electron: npm start or start-ksync.bat');
  process.exit(0);
}

const packageJson = require('./package.json');
app.name = packageJson.name || 'ksync';
if (app.setName) app.setName(packageJson.name || 'ksync');
if (app.setVersion) {
  try { app.setVersion(packageJson.version); } catch (_) {}
}
app.getVersion = () => packageJson.version;
app.setAppUserModelId('com.ksync');

if (app.isPackaged) {
  app.setAppUserModelId('com.ksync');
} else {
  // During development, use process.execPath so Windows Taskbar binds directly to the running executable's icon
  app.setAppUserModelId(process.execPath);
}

function getAppIcon() {
  const icoPath = path.join(__dirname, 'build', 'icon.ico');
  const brandedPng = path.join(__dirname, 'assets', 'app-icon.png');
  // On Windows, passing the raw string path to the .ico preserves multi-resolution Win32 icon frames (16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256)
  if (fs.existsSync(icoPath)) return icoPath;
  if (fs.existsSync(brandedPng)) return brandedPng;
  return undefined;
}

// Avoid Windows "Unable to create cache" / "Gpu Cache Creation failed" errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const tokenStore = require(path.join(__dirname, 'src', 'utils', 'tokenStore.js'));
const settingsStore = require(path.join(__dirname, 'src', 'utils', 'settingsStore.js'));
const SpotifyAuth = require(path.join(__dirname, 'src', 'services', 'SpotifyAuth.js'));
const SpotifyAPI = require(path.join(__dirname, 'src', 'services', 'SpotifyAPI.js'));
const config = require(path.join(__dirname, 'config.js'));
const updateService = require(path.join(__dirname, 'src', 'services', 'UpdateService.js'));
const DiscordRPCService = require(path.join(__dirname, 'src', 'services', 'DiscordRPCService.js'));

const initialSettings = settingsStore.loadSettings();
if (initialSettings.behavior?.discordClientId === '1300812903823474708') {
  initialSettings.behavior.discordClientId = '1565344513881411667';
  try { settingsStore.saveSettings(initialSettings); } catch (_) {}
}
const discordRPC = new DiscordRPCService({
  enabled: initialSettings.behavior?.discordRPC !== false,
  partySync: initialSettings.behavior?.discordPartySync !== false,
  clientId: initialSettings.behavior?.discordClientId || '1565344513881411667',
});

function getSpotifyConfig() {
  const settings = settingsStore.loadSettings();
  const customClientId = settings.behavior?.spotifyClientId?.trim();
  return {
    clientId: customClientId || config.spotify?.clientId || config.SPOTIFY_CLIENT_ID || '9aaae8f6921b4ad3a5b068067d87c0ac',
    clientSecret: config.spotify?.clientSecret || config.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: config.spotify?.redirectUri || config.REDIRECT_URI || 'http://127.0.0.1:8888/callback',
  };
}

const spotifyConfig = new Proxy({}, {
  get(target, prop) {
    const cfg = getSpotifyConfig();
    return cfg[prop];
  },
  set() {
    return true;
  },
});

function normalizePlayerState(body) {
  if (!body) return null;
  const item = body.item;
  // Spotify can return 200 with device but item null (e.g. ad, or no content)
  if (!item) return null;
  const isEpisode = item.type === 'episode' || item.show != null;
  const title = item.name || null;
  const artist = isEpisode
    ? (item.show?.name || 'Podcast')
    : (item.artists || []).map((a) => a.name).join(', ');
  const album = isEpisode ? item.show?.name : item.album?.name;
  const albumArt = isEpisode
    ? (item.images?.[0]?.url || item.show?.images?.[0]?.url)
    : item.album?.images?.[0]?.url;
  return {
    id: item.id,
    title,
    artist: artist || 'Unknown Artist',
    album,
    albumArt,
    duration: (item.duration_ms || 0) / 1000,
    durationMs: item.duration_ms || 0,
    progress: (body.progress_ms || 0) / 1000,
    progressMs: body.progress_ms || 0,
    isPlaying: !!body.is_playing,
    volume: body.device?.volume_percent ?? 50,
    contextUri: body.context?.uri,
    serverTimestamp: Date.now(),
    shuffleState: !!body.shuffle_state,
    repeatState: body.repeat_state || 'off',
    device: body.device,
  };
}

function normalizeQueue(body, contextTitle = null, contextUri = null) {
  if (!body) return { items: [], source: 'Queue', contextUri: null };
  const isUpNext = Array.isArray(body.queue) && body.queue.length > 0;
  const rawList = isUpNext ? body.queue : (body.items ? body.items.map(i => i.track || i) : []);
  const seen = new Set();
  const unique = [];
  for (const track of rawList) {
    if (!track) continue;
    if (unique.length >= 30) break;
    const id = track.id || track.uri;
    if (id && !seen.has(id)) {
      seen.add(id);
      unique.push(track);
    }
  }
  const items = unique.map((track) => ({
    id: track.id,
    uri: track.uri,
    title: track.name || track.title || 'Unknown Title',
    artist: (track.artists || []).map((a) => a.name).join(', ') || track.artist || 'Unknown Artist',
    albumArt: track.album?.images?.[0]?.url || track.albumArt || null,
    duration_ms: track.duration_ms || track.duration,
  }));
  let source = 'Queue';
  if (isUpNext) {
    source = contextTitle || 'Up Next';
  } else if (body.items) {
    source = 'Recently Played';
  } else if (contextTitle) {
    source = contextTitle;
  }
  return { items, source, contextUri };
}

function getDynamicDockHeight(display) {
  const d = display || screen.getPrimaryDisplay();
  const bounds = d.bounds || { width: 1920, height: 1080 };
  const h = bounds.height || 1080;
  // Dynamic responsive dock height proportional to display resolution (~17.2% of screen height)
  // Perfectly and freely fits 3 queue songs with header, NowPlaying and synced lyrics
  // Scales across all systems (e.g. 1080p -> 186px, 1143p -> 197px, 1440p -> 248px, 4K -> 280px)
  const calculated = Math.round(h * 0.172);
  return Math.min(Math.max(calculated, 185), 280);
}

function getTargetDisplay(preferredDisplayId) {
  try {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    if (preferredDisplayId) {
      const found = displays.find((d) => String(d.id) === String(preferredDisplayId));
      if (found) return found;
    }
    const settings = settingsStore.loadSettings();
    const target = settings.position?.targetDisplay || 'all';

    if (target === 'cursor' || target === 'all') {
      const cursorPt = screen.getCursorScreenPoint();
      return screen.getDisplayNearestPoint(cursorPt) || primary;
    }

    if (target && target !== 'primary') {
      const found = displays.find((d) => String(d.id) === String(target));
      if (found) return found;
    }

    return primary;
  } catch (_) {
    return screen.getPrimaryDisplay();
  }
}

function getActiveDisplaysForDock() {
  try {
    const settings = settingsStore.loadSettings();
    const target = settings.position?.targetDisplay || 'all';
    const allDisplays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();

    if (target === 'all') {
      return allDisplays.length > 0 ? allDisplays : [primary];
    }
    if (target === 'cursor') {
      const cursorPt = screen.getCursorScreenPoint();
      return [screen.getDisplayNearestPoint(cursorPt) || primary];
    }
    if (target === 'primary') {
      return [primary];
    }
    const found = allDisplays.find((d) => String(d.id) === String(target));
    if (found) {
      return [found];
    }
    return allDisplays.length > 0 ? allDisplays : [primary];
  } catch (_) {
    return [screen.getPrimaryDisplay()];
  }
}

let isCompactMode = false;

function toggleCompactMode() {
  isCompactMode = !isCompactMode;
  for (const [dispId, win] of dockWindowsMap.entries()) {
    if (win && !win.isDestroyed()) {
      const disp = screen.getAllDisplays().find((d) => String(d.id) === dispId) || screen.getPrimaryDisplay();
      const b = disp.bounds;
      if (isCompactMode) {
        const compactW = 340;
        const compactH = 62;
        const compactX = Math.round(b.x + (b.width - compactW) / 2);
        const compactY = Math.round(b.y + 14);

        win.setBounds({ x: compactX, y: compactY, width: compactW, height: compactH }, true);
        win.webContents.send('compact-mode-changed', { isCompact: true });
      } else {
        const normalBounds = getDockBounds(disp);
        win.setBounds(normalBounds, true);
        win.webContents.send('compact-mode-changed', { isCompact: false });
      }
    }
  }
  return { isCompact: isCompactMode };
}

function getDockBounds(display) {
  const d = display || getTargetDisplay();
  const b = d.bounds || { x: 0, y: 0, width: 1920, height: 1080 };
  const settings = settingsStore.loadSettings();
  const mode = settings.position?.mode || 'top';
  
  if (mode === 'left') {
    const w = Math.min(Math.max(settings.position?.sidebarWidth || 340, 260), 520);
    return { x: b.x, y: b.y, width: w, height: b.height, mode: 'left' };
  } else if (mode === 'right') {
    const w = Math.min(Math.max(settings.position?.sidebarWidth || 340, 260), 520);
    return { x: b.x + b.width - w, y: b.y, width: w, height: b.height, mode: 'right' };
  } else {
    // top mode
    let h = settings.position?.height || getDynamicDockHeight(d);
    if (settings.position?.style === 'island') {
      const isRectangle = settings.position?.islandShape === 'rectangle';
      const defaultW = isRectangle ? 680 : 480;
      const islandW = Math.min(Math.max(settings.position?.islandWidth || defaultW, 380), 720);
      const islandH = 220;
      const islandX = b.x + Math.round((b.width - islandW) / 2);
      return { x: islandX, y: b.y, width: islandW, height: islandH, mode: 'top' };
    }
    return { x: b.x, y: b.y, width: b.width, height: h, mode: 'top' };
  }
}

let dockWindowsMap = new Map(); // displayId -> BrowserWindow
let mainWindow = null;
let lastBroadcastedPlayerState = null;
let lastBroadcastedVolume = null;
let lastExtractedAccent = null;

function broadcastToDocks(channel, ...args) {
  for (const win of dockWindowsMap.values()) {
    if (win && !win.isDestroyed() && win.webContents) {
      try {
        win.webContents.send(channel, ...args);
      } catch (_) {}
    }
  }
}

function updateMainWindowRef() {
  const primaryId = String(screen.getPrimaryDisplay().id);
  mainWindow = dockWindowsMap.get(primaryId) || dockWindowsMap.values().next().value || null;
}

let settingsWindow = null;
let peekWindow = null;
let peekDismissTimeout = null;
let tray = null;
let last403Log = 0;
let dockWidth = 1920;
let scaledWidth = dockWidth;
let scaledHeight = 190;
let lyricsColor = 'white'; // 'white' or 'black'

// Ensure single instance (prevents multiple dock windows)
const isTestMode = process.env.NODE_ENV === 'test' || process.argv.includes('--test') || process.argv.includes('--test-peek');
const gotTheLock = isTestMode || app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Main] Another instance is running, quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    showDock();
  });
}
let isVisible = false;

// Zero-Wake Idle Deep Sleep state (0% CPU target after 3 mins paused)
let isDeepSleep = false;
let lastActivePlaybackTime = Date.now();
let lastMousePollTime = 0;

function enterDeepSleep() {
  if (isDeepSleep) return;
  isDeepSleep = true;
  console.log('[Main] Zero-Wake Idle Deep Sleep activated (0% CPU target)');
  broadcastToDocks('deep-sleep-mode', { isSleeping: true });
}

function wakeFromDeepSleep() {
  if (!isDeepSleep) return;
  isDeepSleep = false;
  lastActivePlaybackTime = Date.now();
  console.log('[Main] Waking from Deep Sleep mode');
  broadcastToDocks('deep-sleep-mode', { isSleeping: false });
}

function updatePlaybackDeepSleep(isPlaying) {
  if (isPlaying) {
    lastActivePlaybackTime = Date.now();
    if (isDeepSleep) wakeFromDeepSleep();
  } else {
    if (!isDeepSleep && Date.now() - lastActivePlaybackTime >= 3 * 60 * 1000) {
      enterDeepSleep();
    }
  }
}
let hideTimeout = null;
let showGraceUntil = Date.now() + 6000;
let initialLaunchPending = true;

let smtcProcess = null;
let cachedSystemVolume = typeof initialSettings.audio?.lastSystemVolume === 'number'
  ? initialSettings.audio.lastSystemVolume
  : null;
let cachedSystemMute = typeof initialSettings.audio?.lastSystemMuted === 'boolean'
  ? initialSettings.audio.lastSystemMuted
  : false;
let cachedSpotifyVolume = typeof initialSettings.audio?.lastSpotifyVolume === 'number'
  ? initialSettings.audio.lastSpotifyVolume
  : null;
let hasReceivedRealSystemVolume = false;
let pendingSystemVolumeResolvers = [];
let lastSetVolumeTime = 0;

function startSmtcSidecar() {
  if (config.playbackBackend !== 'smtc') return;
  if (process.platform !== 'win32') return;

  const compressedPath = path.join(__dirname, 'smtc-bridge', 'bin', 'Release', 'net10.0-windows10.0.19041.0', 'win-x64', 'publish_compressed', 'smtc-bridge.exe');
  const defaultDevPath = path.join(__dirname, 'smtc-bridge', 'bin', 'Release', 'net10.0-windows10.0.19041.0', 'win-x64', 'publish', 'smtc-bridge.exe');
  const exePath = app.isPackaged
    ? path.join(process.resourcesPath, 'smtc-bridge.exe')
    : (fs.existsSync(compressedPath) ? compressedPath : defaultDevPath);
  
  if (!fs.existsSync(exePath)) {
    console.error('[SMTC] Executable not found at:', exePath);
    return;
  }

  smtcProcess = spawn(exePath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  if (smtcProcess.stderr) {
    smtcProcess.stderr.on('data', () => {});
  }

  let smtcBuffer = '';
  smtcProcess.stdout.on('data', (data) => {
    smtcBuffer += data.toString();
    const lines = smtcBuffer.split('\n');
    smtcBuffer = lines.pop(); // Keep the last partial line in the buffer
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const state = JSON.parse(line);
        if (state.type === 'systemVolume') {
          if (Date.now() - lastSetVolumeTime < 800) {
            // Suppress echo bounce during active user adjustments
            return;
          }
          if (typeof state.volume === 'number') cachedSystemVolume = state.volume;
          if (typeof state.isMuted === 'boolean') cachedSystemMute = state.isMuted;
          hasReceivedRealSystemVolume = true;
          while (pendingSystemVolumeResolvers.length > 0) {
            const resolve = pendingSystemVolumeResolvers.shift();
            resolve({ volume: cachedSystemVolume, isMuted: cachedSystemMute });
          }
          lastBroadcastedVolume = {
            volume: cachedSystemVolume,
            isMuted: cachedSystemMute,
          };
          broadcastToDocks('system-volume-changed', lastBroadcastedVolume);
          try {
            settingsStore.saveSettings({
              audio: {
                lastSystemVolume: cachedSystemVolume,
                lastSystemMuted: cachedSystemMute,
              }
            });
          } catch (_) {}
        } else if (state.type === 'spotifyVolume' && typeof state.volume === 'number' && state.volume >= 0) {
          if (Date.now() - lastSetVolumeTime < 800) {
            // Suppress echo bounce during active user adjustments
            return;
          }
          cachedSpotifyVolume = state.volume;
          broadcastToDocks('spotify-volume-changed', { volume: cachedSpotifyVolume });
          try {
            settingsStore.saveSettings({
              audio: {
                lastSpotifyVolume: cachedSpotifyVolume,
              }
            });
          } catch (_) {}
        } else {
          lastBroadcastedPlayerState = state;
          broadcastToDocks('smtc-player-state', state);
          const isPlaying = state.isPlaying !== undefined ? !!state.isPlaying : (state.status === 'Playing');
          updatePlaybackDeepSleep(isPlaying);
          if (state.title && discordRPC) {
            discordRPC.updateTrackActivity({
              title: state.title,
              artist: state.artist,
              album: state.album,
              albumArt: state.artBase64 || state.thumbnail,
              durationMs: state.durationMs,
              positionMs: state.positionMs,
              isPlaying: isPlaying,
              trackId: state.trackId,
            });
          }
        }
      } catch (err) {
        console.error('[SMTC] JSON parse error:', err.message);
      }
    }
  });

  smtcProcess.on('exit', (code) => {
    console.log('[SMTC] exited with code', code);
    smtcProcess = null;
    if (!app.isQuiting) {
      setTimeout(startSmtcSidecar, 3000); // restart on unexpected exit
    }
  });
}

function sendSmtcCommand(cmdObj) {
  if (smtcProcess && smtcProcess.stdin) {
    console.log('[Main] sendSmtcCommand:', cmdObj);
    smtcProcess.stdin.write(JSON.stringify(cmdObj) + '\n');
  } else {
    console.warn('[Main] sendSmtcCommand failed: smtcProcess or stdin unavailable');
  }
}


function createDockWindowForDisplay(display) {
  const b = getDockBounds(display);
  const dispId = String(display.id);

  console.log(`[Dock Window Create] Display ${dispId} (${b.width}x${b.height} at ${b.x},${b.y})`);

  const win = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    icon: getAppIcon(),
    title: `ksync - ${dispId}`,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
  });

  const appIcon = getAppIcon();
  if (appIcon && win.setIcon) {
    try {
      win.setIcon(appIcon);
    } catch (_) {}
  }

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setContentProtection(false);
  win.setIgnoreMouseEvents(false);
  win.setOpacity(isVisible ? 1 : 0);
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, false);

  const loadOptions = lastExtractedAccent ? {
    query: {
      accent: lastExtractedAccent.hex || '',
      rgb: lastExtractedAccent.rgb || '',
      soft: lastExtractedAccent.soft || '',
      glow: lastExtractedAccent.glow || '',
    }
  } : undefined;

  win.loadFile(path.join(__dirname, 'dist', 'index.html'), loadOptions);

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
    win.webContents.send('dock-visible', isVisible);
    win.webContents.send('lyrics-color-changed', lyricsColor);
    if (lastBroadcastedPlayerState) {
      win.webContents.send('smtc-player-state', lastBroadcastedPlayerState);
    }
    if (lastBroadcastedVolume) {
      win.webContents.send('system-volume-changed', lastBroadcastedVolume);
    } else if (cachedSystemVolume !== null) {
      win.webContents.send('system-volume-changed', { volume: cachedSystemVolume, isMuted: cachedSystemMute });
    }
    if (cachedSpotifyVolume !== null) {
      win.webContents.send('spotify-volume-changed', { volume: cachedSpotifyVolume });
    }
    if (lastExtractedAccent) {
      win.webContents.send('extracted-accent-sync', lastExtractedAccent);
    }
    if (isSettingsOpen()) {
      win.webContents.send('settings-window-state', { isOpen: true });
    }
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${dispId} ${level}] ${message} (${path.basename(sourceId || '')}:${line})`);
  });

  win.webContents.on('render-process-gone', (_, details) => {
    console.error(`[Main ${dispId}] Renderer crashed:`, details.reason, details.exitCode);
  });

  win.webContents.on('did-fail-load', (_, code, desc, url) => {
    console.error(`[Main ${dispId}] Load failed:`, code, desc, url);
  });

  win.on('restore', () => {
    if (!win.isDestroyed()) {
      const curB = getDockBounds(display);
      win.setBounds({ x: curB.x, y: curB.y, width: curB.width, height: curB.height }, false);
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  win.on('minimize', (e) => {
    e.preventDefault();
    if (!win.isDestroyed() && win.isMinimized()) {
      win.restore();
    }
  });

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      hideDock();
    }
  });

  win.on('closed', () => {
    dockWindowsMap.delete(dispId);
    updateMainWindowRef();
  });

  return win;
}

function syncDockWindows() {
  const settings = settingsStore.loadSettings();
  const target = settings.position?.targetDisplay || 'all';
  const activeDisplays = getActiveDisplaysForDock();

  // In 'cursor' (mouse travel) mode, keep exactly ONE dock window that follows the cursor
  // seamlessly between displays without destroying or remounting the React tree.
  if (target === 'cursor') {
    const activeDisp = activeDisplays[0] || screen.getPrimaryDisplay();
    const activeDispId = String(activeDisp.id);
    const b = getDockBounds(activeDisp);

    // Reuse any existing window
    let winToKeep = null;
    for (const [dispId, win] of dockWindowsMap.entries()) {
      if (win && !win.isDestroyed()) {
        if (!winToKeep) {
          winToKeep = win;
        } else {
          try { win.destroy(); } catch (_) {}
        }
      }
    }

    dockWindowsMap.clear();

    if (!winToKeep || winToKeep.isDestroyed()) {
      winToKeep = createDockWindowForDisplay(activeDisp);
    } else {
      winToKeep.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, false);
      if (winToKeep.webContents) {
        winToKeep.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
      }
      if (isVisible) {
        winToKeep.setOpacity(1);
        if (winToKeep.showInactive) winToKeep.showInactive();
        else winToKeep.show();
        winToKeep.setAlwaysOnTop(true, 'screen-saver');
      }
    }

    dockWindowsMap.set(activeDispId, winToKeep);
    updateMainWindowRef();
    return;
  }

  const activeDisplayIds = new Set(activeDisplays.map((d) => String(d.id)));

  // 1. Remove windows for displays no longer active
  for (const [dispId, win] of dockWindowsMap.entries()) {
    if (!activeDisplayIds.has(dispId)) {
      if (win && !win.isDestroyed()) {
        try {
          win.destroy();
        } catch (_) {}
      }
      dockWindowsMap.delete(dispId);
    }
  }

  // 2. Create or update windows for active displays
  for (const disp of activeDisplays) {
    const dispId = String(disp.id);
    const b = getDockBounds(disp);
    let win = dockWindowsMap.get(dispId);

    if (!win || win.isDestroyed()) {
      win = createDockWindowForDisplay(disp);
      dockWindowsMap.set(dispId, win);
    } else {
      win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, false);
      if (win.webContents) {
        win.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
      }
    }
  }

  updateMainWindowRef();
}

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const initBounds = getDockBounds(primary);
  dockWidth = initBounds.width;
  scaledWidth = initBounds.width;
  scaledHeight = initBounds.height;

  console.log('[Dock Init Responsive Multi-Display]', {
    initBounds,
    dockWidth,
    scaledWidth,
    scaledHeight,
  });

  try {
    isVisible = true;
    syncDockWindows();

    // Initialize OTA Auto-Updater
    try {
      updateService.init(
        () => [...Array.from(dockWindowsMap.values()), settingsWindow].filter(Boolean),
        () => updateTrayMenu()
      );
    } catch (updaterErr) {
      console.warn('[Main] AutoUpdater init warning:', updaterErr.message);
    }

    // Auto-hide functionality: fast 25ms polling loop across all active displays
    let mouseY = 0;
    let mouseX = 0;
    let lastCursorDisplayId = null;
    setInterval(() => {
      try {
        const settings = settingsStore.loadSettings();
        const mousePosition = screen.getCursorScreenPoint();
        mouseX = mousePosition.x;
        mouseY = mousePosition.y;

        // Multi-display mouse travel mode: seamlessly follow cursor monitor transitions
        const target = settings.position?.targetDisplay || 'all';
        if (target === 'cursor') {
          const currentDisp = screen.getDisplayNearestPoint(mousePosition);
          const currentDispId = currentDisp ? String(currentDisp.id) : null;
          if (currentDispId && currentDispId !== lastCursorDisplayId) {
            lastCursorDisplayId = currentDispId;
            syncDockWindows();
          }
        }

        if (settings.position?.pinned) {
          return;
        }

        // Throttle edge polling during Zero-Wake Deep Sleep when dock is hidden
        if (isDeepSleep && !isVisible) {
          const now = Date.now();
          if (now - lastMousePollTime < 350) return;
          lastMousePollTime = now;
        }

        const mode = settings.position?.mode || 'top';
        const rawTriggerDist = settings.position?.triggerDistance;
        const triggerDist = Math.max(10, typeof rawTriggerDist === 'number' ? Math.max(rawTriggerDist, 10) : 12);
        const triggerSpan = settings.position?.triggerSpan || 'full';

        let isInsideAnyDock = false;
        let isAnyTriggerZone = false;

        const activeDisplays = getActiveDisplaysForDock();
        for (const disp of activeDisplays) {
          const curBounds = disp.bounds;
          let insideThis = false;
          let triggerThis = false;

          if (mode === 'left') {
            const w = Math.min(Math.max(settings.position?.sidebarWidth || 340, 260), 520);
            insideThis =
              mouseX >= curBounds.x &&
              mouseX <= curBounds.x + w &&
              mouseY >= curBounds.y &&
              mouseY <= curBounds.y + curBounds.height;

            let inSpan = true;
            if (triggerSpan === 'center') {
              const minY = curBounds.y + curBounds.height * 0.08;
              const maxY = curBounds.y + curBounds.height * 0.92;
              inSpan = mouseY >= minY && mouseY <= maxY;
            } else if (triggerSpan === 'compact') {
              const minY = curBounds.y + curBounds.height * 0.18;
              const maxY = curBounds.y + curBounds.height * 0.82;
              inSpan = mouseY >= minY && mouseY <= maxY;
            }

            triggerThis =
              mouseX >= (curBounds.x - 6) &&
              mouseX <= curBounds.x + triggerDist &&
              inSpan;
          } else if (mode === 'right') {
            const w = Math.min(Math.max(settings.position?.sidebarWidth || 340, 260), 520);
            insideThis =
              mouseX >= curBounds.x + curBounds.width - w &&
              mouseX <= curBounds.x + curBounds.width &&
              mouseY >= curBounds.y &&
              mouseY <= curBounds.y + curBounds.height;

            let inSpan = true;
            if (triggerSpan === 'center') {
              const minY = curBounds.y + curBounds.height * 0.08;
              const maxY = curBounds.y + curBounds.height * 0.92;
              inSpan = mouseY >= minY && mouseY <= maxY;
            } else if (triggerSpan === 'compact') {
              const minY = curBounds.y + curBounds.height * 0.18;
              const maxY = curBounds.y + curBounds.height * 0.82;
              inSpan = mouseY >= minY && mouseY <= maxY;
            }

            triggerThis =
              mouseX >= curBounds.x + curBounds.width - triggerDist &&
              mouseX <= (curBounds.x + curBounds.width + 6) &&
              inSpan;
          } else {
            // top mode: strictly check mouseY >= curBounds.y to prevent multi-monitor vertical bleed
            const b = getDockBounds(disp);
            insideThis =
              mouseX >= b.x &&
              mouseX <= b.x + b.width &&
              mouseY >= b.y &&
              mouseY <= b.y + b.height;

            let inSpan = true;
            if (settings.position?.style === 'island') {
              if (triggerSpan === 'compact') {
                inSpan = mouseX >= (b.x - 80) && mouseX <= (b.x + b.width + 80);
              } else if (triggerSpan === 'center') {
                inSpan = mouseX >= (b.x - 140) && mouseX <= (b.x + b.width + 140);
              }
            } else {
              if (triggerSpan === 'center') {
                const minX = curBounds.x + curBounds.width * 0.08;
                const maxX = curBounds.x + curBounds.width * 0.92;
                inSpan = mouseX >= minX && mouseX <= maxX;
              } else if (triggerSpan === 'compact') {
                const minX = curBounds.x + curBounds.width * 0.18;
                const maxX = curBounds.x + curBounds.width * 0.82;
                inSpan = mouseX >= minX && mouseX <= maxX;
              }
            }

            triggerThis =
              mouseY >= (curBounds.y - 6) &&
              mouseY <= curBounds.y + triggerDist &&
              inSpan;
          }

          if (insideThis) isInsideAnyDock = true;
          if (triggerThis) isAnyTriggerZone = true;
        }

        if (typeof mouseX === 'number' && typeof mouseY === 'number' && !isNaN(mouseX) && !isNaN(mouseY)) {
          if (isAnyTriggerZone) {
            initialLaunchPending = false;
            showGraceUntil = 0;
            cancelHide();
            if (!isVisible) {
              showDock();
            }
          } else if (isInsideAnyDock) {
            initialLaunchPending = false;
            showGraceUntil = 0;
            cancelHide();
          } else {
            if (initialLaunchPending) return;
            if (Date.now() < showGraceUntil) return;
            if (isVisible) {
              performHide();
            }
          }
        }
      } catch (_) {}
    }, 25);

    // Dynamic screen display event listeners for hot-plugging & scaling
    screen.on('display-added', (event, newDisplay) => {
      console.log('[Screen] Display connected:', newDisplay.id);
      syncDockWindows();
      if (isVisible) showDock();
      updateTrayMenu();
    });

    screen.on('display-removed', (event, oldDisplay) => {
      console.log('[Screen] Display disconnected:', oldDisplay.id);
      syncDockWindows();
      if (isVisible) showDock();
      updateTrayMenu();
    });

    screen.on('display-metrics-changed', (event, display, changedMetrics) => {
      console.log('[Screen] Display metrics changed:', display.id, changedMetrics);
      syncDockWindows();
      if (isVisible) showDock();
      updateTrayMenu();
    });

    // Handle mouse enter/leave events from renderer
    ipcMain.on('mouse-enter', () => {
      initialLaunchPending = false;
      showGraceUntil = 0;
      cancelHide();
    });

    ipcMain.on('mouse-leave', () => {
      if (isVisible) {
        performHide();
      }
    });

    ipcMain.on('scroll-hide', () => {
      performHide(true);
    });

    ipcMain.handle('get-dock-visibility', () => isVisible);
    ipcMain.handle('show-dock', () => showDock());
    ipcMain.handle('hide-dock', (_, force) => hideDock(force));

  // Spotify PKCE login
  ipcMain.handle('spotify-login', async () => {
    try {
      await SpotifyAuth.login(spotifyConfig, tokenStore);
      broadcastToDocks('spotify-login-done');
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('spotify-login-done');
      }
      return { ok: true };
    } catch (err) {
      console.error('[main] Spotify login error:', err);
      return { ok: false, error: err.message || 'Login failed' };
    }
  });

  ipcMain.handle('spotify-has-tokens', () => tokenStore.hasTokens());

  ipcMain.on('spotify-logout', () => {
    tokenStore.clearTokens();
    broadcastToDocks('spotify-logout-done');
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('spotify-logout-done');
    }
  });

  function log403Once(err) {
    if (err.status === 403 && Date.now() - last403Log > 60000) {
      last403Log = Date.now();
      console.error('[Spotify] 403:', err.message);
    }
  }

  ipcMain.handle('spotify-get-player', async () => {
    try {
      const body = await SpotifyAPI.getPlayer(tokenStore, spotifyConfig);
      const normalized = normalizePlayerState(body);
      if (normalized && normalized.contextUri) {
        try {
          normalized.contextTitle = await resolveContextTitle(tokenStore, spotifyConfig, normalized.contextUri);
        } catch (_) {}
      }
      // Log when we get a response but no track (for debugging)
      if (body && !body.item) {
        console.log('[Spotify] Got player state but item is null. Device:', body.device?.name, 'Playing:', body.is_playing);
      }
      return normalized;
    } catch (err) {
      log403Once(err);
      if (err.status === 204 || err.status === 404) {
        console.log('[Spotify] No active device (204/404)');
        return null;
      }
      if (err.status === 429) {
        // Rate limited - return null gracefully, don't spam logs
        const retryAfter = err.retryAfter ? Math.ceil(err.retryAfter / 1000) : 'unknown';
        console.log(`[Spotify] Rate limited (429). Retry after ${retryAfter}s`);
        return null; // Return null instead of throwing so UI doesn't break
      }
      if (err.status === 401) throw new Error('Not authenticated');
      console.error('[Spotify] getPlayer error:', err.status, err.message);
      throw err;
    }
  });

const contextTitleCache = new Map();
const CONTEXT_TITLE_TTL = 10 * 60 * 1000; // 10 minutes cache

async function resolveContextTitle(tokenStore, spotifyConfig, contextUri) {
  if (!contextUri || typeof contextUri !== 'string') return null;

  const cached = contextTitleCache.get(contextUri);
  if (cached && Date.now() - cached.ts < CONTEXT_TITLE_TTL) {
    return cached.title;
  }

  let title = null;
  const pMatch = contextUri.match(/playlist[:/]([a-zA-Z0-9]+)/);
  const aMatch = contextUri.match(/album[:/]([a-zA-Z0-9]+)/);

  if (pMatch) {
    const playlistId = pMatch[1];
    try {
      const pInfo = await SpotifyAPI.getPlaylist(tokenStore, spotifyConfig, playlistId, 'name');
      if (pInfo && pInfo.name) {
        title = `Playlist: ${pInfo.name}`;
      }
    } catch (err) {
      console.warn('[main] Failed to fetch playlist name:', err.message);
      title = 'Playlist';
    }
  } else if (aMatch) {
    const albumId = aMatch[1];
    try {
      const aInfo = await SpotifyAPI.getAlbum(tokenStore, spotifyConfig, albumId);
      if (aInfo && aInfo.name) {
        title = `Album: ${aInfo.name}`;
      }
    } catch (err) {
      console.warn('[main] Failed to fetch album name:', err.message);
      title = 'Album';
    }
  } else if (contextUri.includes(':artist:') || contextUri.includes('/artist/')) {
    title = 'Artist Radio';
  } else if (contextUri.includes('collection')) {
    title = 'Playlist: Liked Songs';
  }

  if (title) {
    contextTitleCache.set(contextUri, { title, ts: Date.now() });
  }
  return title;
}

  ipcMain.handle('spotify-get-queue', async (event, currentTrack) => {
    try {
      if (tokenStore.hasTokens()) {
        let playlistOrAlbumTitle = null;
        let contextUri = null;
        try {
          const player = await SpotifyAPI.getPlayer(tokenStore, spotifyConfig);
          contextUri = player?.context?.uri || player?.contextUri || currentTrack?.contextUri || null;
          if (contextUri) {
            playlistOrAlbumTitle = await resolveContextTitle(tokenStore, spotifyConfig, contextUri);
          } else if (player?.item?.album?.name || currentTrack?.album) {
            playlistOrAlbumTitle = `Album: ${player?.item?.album?.name || currentTrack?.album}`;
          }
        } catch (err) {
          console.warn('[main] getPlayer context fetch:', err.message);
        }

        // 1. Try Spotify live user queue (/me/player/queue)
        try {
          const body = await SpotifyAPI.getQueue(tokenStore, spotifyConfig);
          if (body && Array.isArray(body.queue) && body.queue.length > 0) {
            const normalized = normalizeQueue(body, playlistOrAlbumTitle, contextUri);
            if (normalized.items && normalized.items.length > 0) {
              return normalized;
            }
          }
        } catch (err) {
          console.warn('[main] SpotifyAPI.getQueue:', err.message);
        }

        // 2. If user queue returned empty, fetch the active context's tracks directly!
        if (contextUri) {
          try {
            const pMatch = contextUri.match(/playlist[:/]([a-zA-Z0-9]+)/);
            const aMatch = contextUri.match(/album[:/]([a-zA-Z0-9]+)/);
            if (pMatch) {
              const playlistId = pMatch[1];
              const pData = await SpotifyAPI.getPlaylist(tokenStore, spotifyConfig, playlistId);
              const rawTracks = (pData?.tracks?.items || []).map((i) => i.track || i).filter(Boolean);
              if (rawTracks.length > 0) {
                const normalized = normalizeQueue({ queue: rawTracks }, playlistOrAlbumTitle || `Playlist: ${pData.name}`, contextUri);
                if (normalized.items && normalized.items.length > 0) {
                  return normalized;
                }
              }
            } else if (aMatch) {
              const albumId = aMatch[1];
              const aData = await SpotifyAPI.getAlbum(tokenStore, spotifyConfig, albumId);
              const rawTracks = (aData?.tracks?.items || []).filter(Boolean);
              if (rawTracks.length > 0) {
                const normalized = normalizeQueue({ queue: rawTracks }, playlistOrAlbumTitle || `Album: ${aData.name}`, contextUri);
                if (normalized.items && normalized.items.length > 0) {
                  return normalized;
                }
              }
            }
          } catch (ctxErr) {
            console.warn('[main] Context tracks query failed:', ctxErr.message);
          }
        }

        // 3. Fallback to recently played
        try {
          const recent = await SpotifyAPI.getRecentlyPlayed(tokenStore, spotifyConfig);
          const normalized = normalizeQueue(recent, null, contextUri);
          if (normalized.items && normalized.items.length > 0) {
            return normalized;
          }
        } catch (_) {}
      }

      // 4. Fallback source using client credentials (album / movie soundtrack tracks)
      if (currentTrack && (currentTrack.title || currentTrack.name)) {
        const title = currentTrack.title || currentTrack.name;
        const artist = currentTrack.artist || '';
        const fallback = await SpotifyAPI.getFallbackQueue(spotifyConfig, title, artist);
        if (fallback.items && fallback.items.length > 0) {
          return fallback;
        }
      }

      return { items: [], source: 'Queue' };
    } catch (err) {
      console.error('[main] spotify-get-queue fatal:', err.message);
      return { items: [], source: 'Queue' };
    }
  });

  function cleanLyricsString(str) {
    if (!str) return '';
    return str
      .replace(/\s*[\(\[](feat|ft|with|remaster|mix|version|deluxe|bonus|radio|edit|live|mono|stereo|anniversary|from|ost|original|soundtrack).*?[\)\]]/gi, '')
      .replace(/\s*-\s*(remaster|mix|version|radio|edit|live|mono|stereo|bonus|deluxe|from|ost|soundtrack).*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeLyricsStr(str) {
    if (!str) return '';
    return cleanLyricsString(str)
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  }

  function lyricsLevenshtein(s1, s2) {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    const maxLen = Math.max(m, n);
    return 1 - (dp[m][n] / maxLen);
  }

  function matchLyricsTitle(target, candidate) {
    const nTarget = normalizeLyricsStr(target);
    const nCand = normalizeLyricsStr(candidate);
    if (!nTarget || !nCand) return 0;
    if (nTarget === nCand) return 1.0;
    return lyricsLevenshtein(nTarget, nCand);
  }

  function matchLyricsArtist(target, candidate) {
    const nTarget = normalizeLyricsStr(target);
    const nCand = normalizeLyricsStr(candidate);
    if (!nTarget || !nCand) return 0;
    if (nTarget === nCand) return 1.0;
    const tArtists = (target || '').toLowerCase().split(/[,&/]/).map(s => normalizeLyricsStr(s)).filter(Boolean);
    const cArtists = (candidate || '').toLowerCase().split(/[,&/]/).map(s => normalizeLyricsStr(s)).filter(Boolean);
    for (const t of tArtists) {
      for (const c of cArtists) {
        if (t === c || lyricsLevenshtein(t, c) >= 0.82) return 0.95;
      }
    }
    return lyricsLevenshtein(nTarget, nCand);
  }

  function parseLrcText(lrcText) {
    if (!lrcText) return [];
    const lines = [];
    const timeTag = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/;
    const parts = lrcText.split(/\r?\n/);
    for (const line of parts) {
      const match = line.match(timeTag);
      if (!match) continue;
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const startTime = min * 60 + sec + ms / 1000;
      const text = (match[4] || '').trim();
      if (text) lines.push({ text, startTime });
    }
    lines.sort((a, b) => a.startTime - b.startTime);
    return lines;
  }

  function validateLyricsCandidate(item, title, artist, targetDurationSec) {
    if (!item) return { valid: false, reason: 'No item' };
    const candTitle = item.trackName || item.name || '';
    const candArtist = item.artistName || '';
    const candDuration = item.duration || 0;

    // Gate 1: Title Verification (must be >= 0.78 similarity)
    const titleScore = matchLyricsTitle(title, candTitle);
    if (titleScore < 0.78) {
      return { valid: false, reason: `Title mismatch: ${titleScore.toFixed(2)} (${candTitle} vs ${title})` };
    }

    // Gate 2: Artist Verification (must be >= 0.70 similarity)
    const artistScore = matchLyricsArtist(artist, candArtist);
    if (artistScore < 0.70) {
      return { valid: false, reason: `Artist mismatch: ${artistScore.toFixed(2)} (${candArtist} vs ${artist})` };
    }

    // Gate 3: Duration Tolerance Check (strict: within 4.5 seconds)
    let durationScore = 1.0;
    if (targetDurationSec && targetDurationSec > 0 && candDuration > 0) {
      const durDelta = Math.abs(candDuration - targetDurationSec);
      if (durDelta > 4.5) {
        return { valid: false, reason: `Duration delta too large: ${durDelta.toFixed(1)}s` };
      }
      durationScore = Math.max(0, 1 - (durDelta / 4.5));
    }

    // Gate 4: Real Synchronized LRC Timestamps Required
    // Live karaoke requires verified timestamps. Never fake timestamps for plain lyrics.
    if (!item.syncedLyrics || item.syncedLyrics.trim().length === 0) {
      return { valid: false, reason: 'No verified synced LRC timestamps available' };
    }

    const lines = parseLrcText(item.syncedLyrics);
    if (lines.length < 3) return { valid: false, reason: 'Too few lines' };

    // Gate 5: Non-decreasing timestamps verification
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].startTime < lines[i - 1].startTime) return { valid: false, reason: 'Non-monotonic LRC' };
    }

    // Gate 6: Plausible timestamp span relative to song duration
    if (targetDurationSec && targetDurationSec > 0) {
      const firstTs = lines[0].startTime;
      const lastTs = lines[lines.length - 1].startTime;
      if (firstTs > targetDurationSec * 0.75) {
        return { valid: false, reason: 'First LRC line starts too late' };
      }
      if (lastTs > targetDurationSec + 8 || lastTs < targetDurationSec * 0.40) {
        return { valid: false, reason: `LRC timing span invalid (${lastTs}s vs ${targetDurationSec}s)` };
      }
    }

    const totalScore = (titleScore * 40) + (artistScore * 40) + (durationScore * 20);
    return { valid: true, lines, isSynced: true, score: totalScore };
  }

  ipcMain.handle('spotify-get-lyrics', async (_, track) => {
    if (!track || (!track.title && !track.name)) {
      return { lines: [], provider: null };
    }
    const rawTitle = track.title || track.name || '';
    const rawArtist = track.artist || (track.artists ? track.artists.map((a) => a.name).join(', ') : '');
    const duration = track.duration || (track.durationMs ? track.durationMs / 1000 : (track.duration_ms ? track.duration_ms / 1000 : 0));
    const cleanAlbum = cleanLyricsString(track.album || '');

    const cleanTitle = cleanLyricsString(rawTitle);
    const cleanArtist = cleanLyricsString(rawArtist);
    const primaryArtist = cleanArtist.split(/[,&/]/)[0].trim();
    const userAgent = 'ksync/1.0.0 (https://github.com/kiru-studio/Ksync)';

    console.log('[Lyrics Multi-Layer] Checking:', { cleanTitle, cleanArtist, primaryArtist, duration });

    // Layer 1: Exact GET signature match
    try {
      let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      if (duration > 0) url += `&duration=${Math.round(duration)}`;
      if (cleanAlbum) url += `&album_name=${encodeURIComponent(cleanAlbum)}`;
      const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const data = await res.json();
        const v = validateLyricsCandidate(data, rawTitle, rawArtist, duration);
        if (v.valid && v.isSynced) {
          console.log('[Lyrics] Layer 1 Exact Match found:', v.lines.length, 'lines');
          return { lines: v.lines, provider: 'LRCLIB (Exact Synced)' };
        }
      }
    } catch (_) {}

    // Layer 2: Clean Title + Primary Artist + Duration via GET
    try {
      let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
      if (duration > 0) url += `&duration=${Math.round(duration)}`;
      const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const data = await res.json();
        const v = validateLyricsCandidate(data, rawTitle, rawArtist, duration);
        if (v.valid && v.isSynced) {
          console.log('[Lyrics] Layer 2 Primary Artist Match found:', v.lines.length, 'lines');
          return { lines: v.lines, provider: 'LRCLIB (Synced)' };
        }
      }
    } catch (_) {}

    // Layer 3: Clean Title + Primary Artist (without duration param, duration verified post-fetch)
    try {
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
      const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const data = await res.json();
        const v = validateLyricsCandidate(data, rawTitle, rawArtist, duration);
        if (v.valid && v.isSynced) {
          console.log('[Lyrics] Layer 3 Match found:', v.lines.length, 'lines');
          return { lines: v.lines, provider: 'LRCLIB (Synced)' };
        }
      }
    } catch (_) {}

    // Layer 4: Field Search (/api/search?track_name=...&artist_name=...)
    try {
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
      const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const candidates = [];
          for (const item of results) {
            const v = validateLyricsCandidate(item, rawTitle, rawArtist, duration);
            if (v.valid) candidates.push(v);
          }
          if (candidates.length > 0) {
            candidates.sort((a, b) => b.score - a.score);
            const best = candidates[0];
            console.log('[Lyrics] Layer 4 Field Search Match found:', best.lines.length, 'lines');
            return { lines: best.lines, provider: best.isSynced ? 'LRCLIB (Synced)' : 'LRCLIB' };
          }
        }
      }
    } catch (_) {}

    // Layer 5: Fallback Full Search with Strict Multi-Layer Scoring
    try {
      const query = `${cleanTitle} ${primaryArtist}`.trim();
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const candidates = [];
          for (const item of results) {
            const v = validateLyricsCandidate(item, rawTitle, rawArtist, duration);
            if (v.valid) candidates.push(v);
          }
          if (candidates.length > 0) {
            candidates.sort((a, b) => b.score - a.score);
            const best = candidates[0];
            console.log('[Lyrics] Layer 5 Search Match found:', best.lines.length, 'lines');
            return { lines: best.lines, provider: best.isSynced ? 'LRCLIB (Synced)' : 'LRCLIB' };
          }
        }
      }
    } catch (_) {}

    console.log('[Lyrics] Multi-layer verification exhausted. No verified lyrics found for track:', cleanTitle);
    return { lines: [], provider: null };
  });

  ipcMain.handle('spotify-play', () => SpotifyAPI.play(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-play-track', async (_, payload) => {
    const uri = typeof payload === 'string' ? payload : payload?.uri;
    let contextUri = typeof payload === 'object' ? payload?.contextUri : null;
    if (!uri) return { ok: false, error: 'No URI provided' };
    console.log('[main] spotify-play-track called with uri:', uri, 'context:', contextUri);

    const cleanUri = uri.replace(/:play$/i, '');
    const spotifyUri = cleanUri.startsWith('spotify:') ? cleanUri : `spotify:track:${cleanUri}`;

    if (tokenStore.hasTokens()) {
      try {
        // Detect active context if not explicitly passed
        if (!contextUri) {
          try {
            const player = await SpotifyAPI.getPlayer(tokenStore, spotifyConfig);
            if (player?.context?.uri) {
              contextUri = player.context.uri;
            }
          } catch (_) {}
        }

        // If we have a playlist/album/artist context, play with offset to preserve the ongoing playlist queue!
        if (contextUri && (contextUri.includes(':playlist:') || contextUri.includes(':album:') || contextUri.includes(':artist:'))) {
          try {
            await SpotifyAPI.play(tokenStore, spotifyConfig, {
              context_uri: contextUri,
              offset: { uri: spotifyUri },
            });
            console.log('[main] spotify-play-track succeeded via playlist offset play');
            return { ok: true };
          } catch (ctxErr) {
            console.warn('[main] Context-based play failed, trying fallback to single uri:', ctxErr.message);
          }
        }

        // Fallback to single track
        await SpotifyAPI.play(tokenStore, spotifyConfig, { uris: [spotifyUri] });
        console.log('[main] spotify-play-track succeeded via Web API single track');
        return { ok: true };
      } catch (err) {
        console.warn('[main] Web API play failed:', err.message);
        return { ok: false, error: err.message };
      }
    }

    return { ok: false, error: 'No Spotify Web API tokens' };
  });
  ipcMain.handle('spotify-pause', () => SpotifyAPI.pause(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-skip-next', () => SpotifyAPI.skipNext(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-skip-previous', () => SpotifyAPI.skipPrevious(tokenStore, spotifyConfig));
  let spotifyWebVolumeDebounceTimer = null;
  ipcMain.handle('spotify-set-volume', async (_, volume) => {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    cachedSpotifyVolume = clamped;
    lastSetVolumeTime = Date.now();

    // 1. Instantly control local Spotify desktop audio session via native Windows WASAPI (0ms hardware latency)
    if (smtcProcess && smtcProcess.stdin) {
      sendSmtcCommand({ cmd: 'setSpotifyVolume', volume: clamped });
    }

    // Broadcast volume update to all docks so UI stays reactive
    broadcastToDocks('spotify-volume-changed', { volume: clamped });

    // 2. Debounced asynchronous background sync with Spotify Web API (controls active Spotify Connect device)
    if (tokenStore.hasTokens()) {
      if (spotifyWebVolumeDebounceTimer) clearTimeout(spotifyWebVolumeDebounceTimer);
      spotifyWebVolumeDebounceTimer = setTimeout(async () => {
        try {
          await SpotifyAPI.setVolume(tokenStore, spotifyConfig, clamped);
        } catch (err) {
          console.warn('[main] Spotify Web API setVolume warning:', err.message);
        }
      }, 250);
    }

    return { ok: true, volume: clamped };
  });
  ipcMain.handle('spotify-seek', (_, positionMs) => SpotifyAPI.seek(tokenStore, spotifyConfig, positionMs));
  ipcMain.handle('spotify-set-shuffle', (_, state) => SpotifyAPI.setShuffle(tokenStore, spotifyConfig, state));
  ipcMain.handle('spotify-set-repeat', (_, state) => SpotifyAPI.setRepeat(tokenStore, spotifyConfig, state));
  ipcMain.handle('spotify-get-current-user', () => SpotifyAPI.getCurrentUser(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-get-devices', async () => {
    try {
      return await SpotifyAPI.getDevices(tokenStore, spotifyConfig);
    } catch (err) {
      if (err.status === 429) {
        // Rate limited - return empty array gracefully
        console.log('[Spotify] Rate limited (429) on getDevices');
        return { devices: [] };
      }
      if (err.status === 401) throw new Error('Not authenticated');
      throw err;
    }
  });
  ipcMain.handle('spotify-transfer-playback', (_, deviceIds, play) =>
    SpotifyAPI.transferPlayback(tokenStore, spotifyConfig, deviceIds, play)
  );

  async function resolveCanonicalTrackId(trackId, title, artist) {
    if (trackId && typeof trackId === 'string' && !trackId.startsWith('smtc-')) {
      return trackId;
    }
    if (!title) return null;
    try {
      const cleanT = (title || '')
        .replace(/\s*[\(\[](feat|ft|with|remaster|mix|version|deluxe|bonus|radio|edit|live).*?[\)\]]/gi, '')
        .trim();
      const cleanA = (artist || '').split(/[,&]/)[0].trim();
      const query = `${cleanT} ${cleanA}`.trim();
      const track = await SpotifyAPI.searchTrack(spotifyConfig, query);
      return track?.id || null;
    } catch (_) {
      return null;
    }
  }

  ipcMain.handle('spotify-check-saved-tracks', async (_, payload) => {
    if (!tokenStore.hasTokens()) return [];
    try {
      const { trackId, title, artist } = typeof payload === 'object' ? payload : { trackId: payload };
      const canonicalId = await resolveCanonicalTrackId(trackId, title, artist);
      if (!canonicalId) return [];
      return await SpotifyAPI.checkUserSavedTracks(tokenStore, spotifyConfig, [canonicalId]);
    } catch (err) {
      return [];
    }
  });

  ipcMain.handle('spotify-save-track', async (_, payload) => {
    if (!tokenStore.hasTokens()) return { ok: false, error: 'Not authenticated' };
    try {
      const { trackId, title, artist } = typeof payload === 'object' ? payload : { trackId: payload };
      const canonicalId = await resolveCanonicalTrackId(trackId, title, artist);
      if (!canonicalId) return { ok: false, error: 'Track not found' };
      await SpotifyAPI.saveUserTracks(tokenStore, spotifyConfig, [canonicalId]);
      return { ok: true, trackId: canonicalId };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('spotify-remove-track', async (_, payload) => {
    if (!tokenStore.hasTokens()) return { ok: false, error: 'Not authenticated' };
    try {
      const { trackId, title, artist } = typeof payload === 'object' ? payload : { trackId: payload };
      const canonicalId = await resolveCanonicalTrackId(trackId, title, artist);
      if (!canonicalId) return { ok: false, error: 'Track not found' };
      await SpotifyAPI.removeUserTracks(tokenStore, spotifyConfig, [canonicalId]);
      return { ok: true, trackId: canonicalId };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('spotify-get-audio-features', async (_, payload) => {
    try {
      const { trackId, title, artist } = typeof payload === 'object' && payload !== null ? payload : { trackId: payload };
      const canonicalId = await resolveCanonicalTrackId(trackId, title, artist);
      if (!canonicalId) return null;
      return await SpotifyAPI.getAudioFeatures(tokenStore, spotifyConfig, canonicalId);
    } catch (_) {
      return null;
    }
  });

  // SMTC IPC Commands
  ipcMain.handle('smtc-play', () => sendSmtcCommand({ cmd: 'play' }));
  ipcMain.handle('smtc-pause', () => sendSmtcCommand({ cmd: 'pause' }));
  ipcMain.handle('smtc-play-pause', () => sendSmtcCommand({ cmd: 'playPause' }));
  ipcMain.handle('smtc-skip-next', () => sendSmtcCommand({ cmd: 'next' }));
  ipcMain.handle('smtc-skip-previous', () => sendSmtcCommand({ cmd: 'previous' }));
  ipcMain.handle('smtc-skip-n', async (_, count) => {
    const steps = Math.min(Math.max(1, count || 1), 30);
    console.log('[Main] smtc-skip-n called with count:', count, 'steps:', steps);
    for (let i = 0; i < steps; i++) {
      sendSmtcCommand({ cmd: 'next' });
      if (i < steps - 1) {
        await new Promise((r) => setTimeout(r, 280));
      }
    }
    return { ok: true };
  });
  ipcMain.handle('smtc-skip-prev-n', async (_, count) => {
    const steps = Math.min(Math.max(1, count || 1), 30);
    console.log('[Main] smtc-skip-prev-n called with count:', count, 'steps:', steps);
    for (let i = 0; i < steps; i++) {
      sendSmtcCommand({ cmd: 'previous' });
      if (i < steps - 1) {
        await new Promise((r) => setTimeout(r, 280));
      }
    }
    return { ok: true };
  });
  ipcMain.handle('smtc-seek', (_, positionMs) => sendSmtcCommand({ cmd: 'seek', positionMs }));

  ipcMain.handle('get-playback-backend', () => config.playbackBackend || 'smtc');

  // Windows Master Audio System Volume IPC Commands
  ipcMain.handle('get-system-volume', async () => {
    if (smtcProcess && smtcProcess.stdin) {
      sendSmtcCommand({ cmd: 'getSystemVolume' });
    }
    if (!hasReceivedRealSystemVolume && smtcProcess) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve({ volume: cachedSystemVolume ?? 50, isMuted: cachedSystemMute });
        }, 800);
        pendingSystemVolumeResolvers.push((val) => {
          clearTimeout(timer);
          resolve(val);
        });
      });
    }
    return { volume: cachedSystemVolume ?? 50, isMuted: cachedSystemMute };
  });

  ipcMain.handle('get-spotify-volume', async () => {
    if (smtcProcess && smtcProcess.stdin) {
      sendSmtcCommand({ cmd: 'getSpotifyVolume' });
    }
    return { volume: cachedSpotifyVolume ?? 50 };
  });

  ipcMain.handle('set-system-volume', async (_, volume) => {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    cachedSystemVolume = clamped;
    lastSetVolumeTime = Date.now();
    if (smtcProcess && smtcProcess.stdin) {
      sendSmtcCommand({ cmd: 'setSystemVolume', volume: clamped });
    }
    lastBroadcastedVolume = {
      volume: cachedSystemVolume,
      isMuted: cachedSystemMute,
    };
    broadcastToDocks('system-volume-changed', lastBroadcastedVolume);
    return { volume: cachedSystemVolume, isMuted: cachedSystemMute };
  });

  ipcMain.handle('set-system-mute', async (_, isMuted) => {
    cachedSystemMute = !!isMuted;
    if (smtcProcess && smtcProcess.stdin) {
      sendSmtcCommand({ cmd: 'setSystemMute', isMuted: cachedSystemMute });
    }
    lastBroadcastedVolume = {
      volume: cachedSystemVolume,
      isMuted: cachedSystemMute,
    };
    broadcastToDocks('system-volume-changed', lastBroadcastedVolume);
    return { volume: cachedSystemVolume, isMuted: cachedSystemMute };
  });

  // Multi-Monitor & Windows 11 Integration
  ipcMain.handle('get-all-displays', () => {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    return displays.map((d, index) => ({
      id: String(d.id),
      index: index + 1,
      isPrimary: d.id === primary.id,
      width: d.bounds.width,
      height: d.bounds.height,
      label: `Display ${index + 1}${d.id === primary.id ? ' (Primary)' : ''} · ${d.bounds.width}×${d.bounds.height}`,
    }));
  });

  ipcMain.handle('wake-from-deep-sleep', () => wakeFromDeepSleep());
  ipcMain.handle('toggle-compact-mode', () => toggleCompactMode());
  ipcMain.handle('get-compact-mode', () => isCompactMode);

  ipcMain.handle('update-discord-rpc', (_, trackInfo) => {
    if (discordRPC) {
      discordRPC.updateTrackActivity(trackInfo);
    }
    return { ok: true };
  });

  ipcMain.handle('trigger-track-peek', (_, trackData) => {
    showTrackPeek(trackData);
    return { ok: true };
  });

  ipcMain.handle('get-current-peek-data', () => lastTrackPeekData);

  ipcMain.handle('dismiss-track-peek', () => {
    dismissTrackPeek();
    return { ok: true };
  });

  ipcMain.on('save-extracted-accent', (event, accent) => {
    if (accent && accent.hex) {
      lastExtractedAccent = accent;
      broadcastToDocks('extracted-accent-sync', accent);
    }
  });

  // Settings & Positioning IPC
  ipcMain.handle('get-settings', () => settingsStore.loadSettings());
  ipcMain.handle('save-settings', (_, newSettings) => {
    const updated = settingsStore.saveSettings(newSettings);
    syncDockWindows();
    broadcastToDocks('settings-changed', updated);
    if (isSettingsActive()) showDock();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      const b = getDockBounds(screen.getPrimaryDisplay());
      settingsWindow.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
      settingsWindow.webContents.send('settings-changed', updated);
    }
    if (newSettings && newSettings.behavior && discordRPC) {
      if (typeof newSettings.behavior.discordRPC === 'boolean') {
        discordRPC.setEnabled(newSettings.behavior.discordRPC);
      }
      if (typeof newSettings.behavior.discordPartySync === 'boolean') {
        discordRPC.setPartySync(newSettings.behavior.discordPartySync);
      }
      if (newSettings.behavior.discordClientId) {
        discordRPC.setClientId(newSettings.behavior.discordClientId);
      }
    }
    updateTrayMenu();
    return updated;
  });
  ipcMain.handle('reset-settings', () => {
    const def = settingsStore.resetSettings();
    syncDockWindows();
    broadcastToDocks('settings-changed', def);
    if (isSettingsActive()) showDock();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      const b = getDockBounds(screen.getPrimaryDisplay());
      settingsWindow.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
      settingsWindow.webContents.send('settings-changed', def);
    }
    updateTrayMenu();
    return def;
  });
  ipcMain.handle('toggle-pin', () => {
    const s = settingsStore.loadSettings();
    const isPinned = !s.position?.pinned;
    const updated = settingsStore.saveSettings({ position: { pinned: isPinned } });
    broadcastToDocks('settings-changed', updated);
    if (isPinned) {
      showDock();
    }
    updateTrayMenu();
    return isPinned;
  });
  ipcMain.handle('set-dock-height', (_, height) => {
    const clamped = Math.min(Math.max(Number(height) || 190, 140), 320);
    const updated = settingsStore.saveSettings({ position: { height: clamped } });
    syncDockWindows();
    broadcastToDocks('settings-changed', updated);
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      const b = getDockBounds(screen.getPrimaryDisplay());
      settingsWindow.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
      settingsWindow.webContents.send('settings-changed', updated);
    }
    return clamped;
  });
  ipcMain.handle('set-sidebar-width', (_, width) => {
    const clamped = Math.min(Math.max(Number(width) || 340, 260), 520);
    const updated = settingsStore.saveSettings({ position: { sidebarWidth: clamped } });
    syncDockWindows();
    broadcastToDocks('settings-changed', updated);
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      const b = getDockBounds(screen.getPrimaryDisplay());
      settingsWindow.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
      settingsWindow.webContents.send('settings-changed', updated);
    }
    return clamped;
  });
  ipcMain.handle('open-spotify-app', () => {
    shell.openExternal('spotify:');
    return { ok: true };
  });
  ipcMain.handle('open-external-url', (_, targetUrl) => {
    if (typeof targetUrl === 'string' && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
      shell.openExternal(targetUrl);
      return { ok: true };
    }
    return { ok: false, error: 'Invalid URL' };
  });
  ipcMain.handle('open-settings-window', () => {
    openSettingsWindow();
    return { ok: true };
  });
  ipcMain.handle('is-settings-open', () => isSettingsOpen());
  ipcMain.handle('close-settings', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
    broadcastSettingsState();
    return { ok: true };
  });
  ipcMain.handle('minimize-settings', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.minimize();
    }
    broadcastSettingsState();
    const settings = settingsStore.loadSettings();
    if (!settings.position?.pinned) {
      performHide(true);
    }
    return { ok: true };
  });
  ipcMain.handle('get-dock-dimensions', (event) => {
    try {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      for (const [dispId, win] of dockWindowsMap.entries()) {
        if (win === senderWin) {
          const disp = screen.getAllDisplays().find((d) => String(d.id) === dispId);
          const b = getDockBounds(disp);
          return { width: b.width, height: b.height, mode: b.mode, x: b.x, y: b.y };
        }
      }
    } catch (_) {}
    const b = getDockBounds();
    return { width: b.width, height: b.height, mode: b.mode, x: b.x, y: b.y };
  });

  // OTA Auto-Updater IPC Handlers
  ipcMain.handle('check-for-updates', () => updateService.checkForUpdates(true));
  ipcMain.handle('download-update', () => updateService.downloadUpdate());
  ipcMain.handle('quit-and-install', () => updateService.quitAndInstall());
  ipcMain.handle('quit-app', () => quitApp());
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-update-status', () => updateService.getStatus());

  // Windows Startup / Login Item Settings
  ipcMain.handle('get-login-item-settings', () => {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch (_) {
      return false;
    }
  });
  ipcMain.handle('set-login-item-settings', (_, openAtLogin) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!openAtLogin,
        path: process.execPath,
      });
      return app.getLoginItemSettings().openAtLogin;
    } catch (err) {
      console.warn('[Main] setLoginItemSettings error:', err.message);
      return false;
    }
  });

  } catch (err) {
    console.error('[Main] createWindow error:', err);
    throw err;
  }
}

function isAnyKsyncWindowFocused() {
  if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isFocused()) return true;
  if (peekWindow && !peekWindow.isDestroyed() && peekWindow.isFocused()) return true;
  for (const win of dockWindowsMap.values()) {
    if (win && !win.isDestroyed() && win.isFocused()) return true;
  }
  return false;
}

function isCursorInsideAnyDock() {
  try {
    const pt = screen.getCursorScreenPoint();
    const activeDisplays = getActiveDisplaysForDock();
    for (const disp of activeDisplays) {
      const b = getDockBounds(disp);
      const isInside = pt.x >= b.x && pt.x <= (b.x + b.width) && pt.y >= b.y && pt.y <= (b.y + b.height);
      if (isInside) return true;
    }
  } catch (_) {}
  return false;
}

function isSettingsActive() {
  if (!settingsWindow || settingsWindow.isDestroyed()) return false;
  if (settingsWindow.isMinimized() || !settingsWindow.isVisible()) return false;
  return settingsWindow.isFocused();
}

function isSettingsOpen() {
  if (!settingsWindow || settingsWindow.isDestroyed()) return false;
  if (settingsWindow.isMinimized()) return false;
  return settingsWindow.isVisible();
}

function broadcastSettingsState() {
  const open = isSettingsOpen();
  broadcastToDocks('settings-window-state', { isOpen: open });
}

function openSettingsWindow() {
  const primary = screen.getPrimaryDisplay();
  const dockB = getDockBounds(primary);

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.maximize();
    settingsWindow.show();
    settingsWindow.focus();
    broadcastSettingsState();
    showDock();
    setTimeout(showDock, 150);
    settingsWindow.webContents.send('dock-dimensions', { width: dockB.width, height: dockB.height, mode: dockB.mode });
    return;
  }

  const b = primary.bounds;

  settingsWindow = new BrowserWindow({
    width: b.width,
    height: b.height,
    minWidth: 800,
    minHeight: 560,
    icon: getAppIcon(),
    title: 'ksync',
    backgroundColor: '#09090b',
    backgroundMaterial: process.platform === 'win32' ? 'mica' : undefined,
    frame: false, // Sleek frameless Tony Stark HUD interface
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'dist', 'index.html'), { hash: 'settings' });

  settingsWindow.once('ready-to-show', () => {
    const appIcon = getAppIcon();
    if (appIcon && settingsWindow.setIcon) {
      try {
        settingsWindow.setIcon(appIcon);
      } catch (_) {}
    }
    settingsWindow.setContentProtection(false);
    settingsWindow.maximize();
    settingsWindow.show();
    broadcastSettingsState();
    showDock();
    setTimeout(showDock, 150);
    const currentDockBounds = getDockBounds(screen.getPrimaryDisplay());
    settingsWindow.webContents.send('dock-dimensions', {
      width: currentDockBounds.width,
      height: currentDockBounds.height,
      mode: currentDockBounds.mode,
    });
  });

  // Keep dock visible and unminimized whenever settings window is restored, shown, focused, or maximized
  settingsWindow.on('restore', () => {
    broadcastSettingsState();
    showDock();
    setTimeout(showDock, 150);
  });

  settingsWindow.on('focus', () => {
    broadcastSettingsState();
    showDock();
  });

  settingsWindow.on('blur', () => {
    setTimeout(() => {
      if (!isAnyKsyncWindowFocused() && !isCursorInsideAnyDock()) {
        const settings = settingsStore.loadSettings();
        if (!settings.position?.pinned) {
          console.log('[Main] Settings blurred and navigated away -> hiding dock');
          showGraceUntil = 0;
          performHide(true);
        }
      }
    }, 120);
  });

  settingsWindow.on('show', () => {
    broadcastSettingsState();
    showDock();
    setTimeout(showDock, 150);
  });

  settingsWindow.on('maximize', () => {
    broadcastSettingsState();
    showDock();
    setTimeout(showDock, 150);
  });

  settingsWindow.on('minimize', () => {
    broadcastSettingsState();
    const settings = settingsStore.loadSettings();
    if (!settings.position?.pinned) {
      performHide(true);
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    broadcastSettingsState();
    scheduleHide(800);
  });
}

function getOrCreatePeekWindow() {
  if (peekWindow && !peekWindow.isDestroyed()) {
    return peekWindow;
  }

  const d = getTargetDisplay();
  const b = d.bounds;
  const peekW = 380;
  const peekH = 76;
  const peekX = Math.round(b.x + (b.width - peekW) / 2);
  const peekY = Math.round(b.y + 12);

  peekWindow = new BrowserWindow({
    width: peekW,
    height: peekH,
    x: peekX,
    y: peekY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  peekWindow.setAlwaysOnTop(true, 'screen-saver');
  peekWindow.loadFile(path.join(__dirname, 'dist', 'index.html'), { hash: 'peek' });

  peekWindow.on('closed', () => {
    peekWindow = null;
  });

  return peekWindow;
}

let lastTrackPeekData = null;

function showTrackPeek(trackData) {
  lastTrackPeekData = trackData;
  const settings = settingsStore.loadSettings();
  if (settings.behavior?.trackChangePeek === false) return;
  if (isVisible && !process.argv.includes('--test-peek')) return; // Do not peek if dock is already open/visible
  if (isSettingsOpen() && !process.argv.includes('--test-peek')) return; // Do not peek if settings window is open

  const win = getOrCreatePeekWindow();

  // Position at top center of target display
  const d = getTargetDisplay();
  const b = d.bounds;
  const peekW = 380;
  const peekH = 76;
  const peekX = Math.round(b.x + (b.width - peekW) / 2);
  const peekY = Math.round(b.y + 12);

  win.setBounds({ x: peekX, y: peekY, width: peekW, height: peekH }, false);
  win.setAlwaysOnTop(true, 'screen-saver');

  if (win.showInactive) {
    win.showInactive();
  } else {
    win.show();
  }

  const sendData = () => {
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('track-peek-data', trackData);
    }
  };

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', sendData);
  } else {
    sendData();
  }

  if (peekDismissTimeout) {
    clearTimeout(peekDismissTimeout);
    peekDismissTimeout = null;
  }
}

function dismissTrackPeek() {
  if (peekDismissTimeout) {
    clearTimeout(peekDismissTimeout);
    peekDismissTimeout = null;
  }
  if (peekWindow && !peekWindow.isDestroyed()) {
    peekWindow.hide();
  }
}

function showDock() {
  dismissTrackPeek();
  cancelHide();
  showGraceUntil = Date.now() + 600;
  isVisible = true;

  syncDockWindows();

  for (const [dispId, win] of dockWindowsMap.entries()) {
    if (win && !win.isDestroyed()) {
      const disp = screen.getAllDisplays().find((d) => String(d.id) === dispId) || screen.getPrimaryDisplay();
      const b = getDockBounds(disp);

      if (win.isMinimized()) {
        win.restore();
      }
      win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, false);
      if (win.webContents) {
        win.webContents.send('dock-dimensions', { width: b.width, height: b.height, mode: b.mode });
        win.webContents.send('dock-visible', true);
      }
      win.setOpacity(1);
      if (win.showInactive) {
        win.showInactive();
      } else {
        win.show();
      }
      win.setIgnoreMouseEvents(false);
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    }
  }

  updateTrayMenu();
}

function scheduleHide(delayMs = 30) {
  const settings = settingsStore.loadSettings();
  if (settings.position?.pinned) return;
  if (isSettingsActive()) return; // Keep dock visible as live preview while settings is actively in use
  if (initialLaunchPending || Date.now() < showGraceUntil) return;
  if (hideTimeout) return;
  hideTimeout = setTimeout(() => {
    hideTimeout = null;
    performHide();
  }, delayMs);
}

function cancelHide() {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function performHide(force = false) {
  const settings = settingsStore.loadSettings();
  if (!force && settings.position?.pinned) return;
  if (!force && isSettingsActive()) return; // Keep dock visible as live preview while settings is actively in use
  if (!isVisible) return;
  if (!force && (initialLaunchPending || Date.now() < showGraceUntil)) return;

  try {
    const pt = screen.getCursorScreenPoint();
    const activeDisplays = getActiveDisplaysForDock();
    for (const disp of activeDisplays) {
      const b = getDockBounds(disp);
      const isActuallyInside = pt.x >= b.x && pt.x <= (b.x + b.width) && pt.y >= b.y && pt.y <= (b.y + b.height);
      if (!force && isActuallyInside) {
        return;
      }
    }
  } catch (_) {}

  cancelHide();
  isVisible = false;
  console.log('[Main] Hiding dock smoothly across all active displays.');

  for (const win of dockWindowsMap.values()) {
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('dock-visible', false);
      win.setIgnoreMouseEvents(true);
    }
  }

  setTimeout(() => {
    if (!isVisible) {
      for (const win of dockWindowsMap.values()) {
        if (win && !win.isDestroyed()) {
          win.setAlwaysOnTop(false);
          win.setOpacity(0);
          win.hide();
        }
      }
    }
  }, 240);

  updateTrayMenu();
}

function hideDock(force = false) {
  if (force) {
    performHide(true);
  } else {
    performHide();
  }
}

function buildTrayMenu() {
  const settings = settingsStore.loadSettings();
  const isPinned = !!settings.position?.pinned;
  const allDisplays = screen.getAllDisplays();
  const displayMenuItems = allDisplays.length > 1 ? [
    {
      label: 'Target Displays',
      submenu: [
        {
          label: 'All Displays (All Screens)',
          type: 'radio',
          checked: (settings.position?.targetDisplay || 'all') === 'all',
          click: () => {
            const updated = settingsStore.saveSettings({ position: { targetDisplay: 'all' } });
            syncDockWindows();
            broadcastToDocks('settings-changed', updated);
            showDock();
            updateTrayMenu();
          },
        },
        {
          label: 'Primary Display',
          type: 'radio',
          checked: settings.position?.targetDisplay === 'primary',
          click: () => {
            const updated = settingsStore.saveSettings({ position: { targetDisplay: 'primary' } });
            syncDockWindows();
            broadcastToDocks('settings-changed', updated);
            showDock();
            updateTrayMenu();
          },
        },
        {
          label: 'Follow Mouse Cursor',
          type: 'radio',
          checked: settings.position?.targetDisplay === 'cursor',
          click: () => {
            const updated = settingsStore.saveSettings({ position: { targetDisplay: 'cursor' } });
            syncDockWindows();
            broadcastToDocks('settings-changed', updated);
            showDock();
            updateTrayMenu();
          },
        },
        ...allDisplays.map((disp, idx) => ({
          label: `Display ${idx + 1}${disp.id === screen.getPrimaryDisplay().id ? ' (Primary)' : ''} · ${disp.bounds.width}×${disp.bounds.height}`,
          type: 'radio',
          checked: String(settings.position?.targetDisplay) === String(disp.id),
          click: () => {
            const updated = settingsStore.saveSettings({ position: { targetDisplay: disp.id } });
            syncDockWindows();
            broadcastToDocks('settings-changed', updated);
            showDock();
            updateTrayMenu();
          },
        })),
      ],
    },
    { type: 'separator' },
  ] : [];

  return Menu.buildFromTemplate([
    {
      label: 'Open Settings & Configurator',
      click: () => openSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: isVisible ? 'Hide dock (Ctrl+Alt+S)' : 'Show dock (Ctrl+Alt+S)',
      click: () => {
        if (isVisible) hideDock(true);
        else showDock();
      },
    },
    {
      label: isPinned ? '✓ Dock Pinned (Always Open)' : 'Pin Dock (Always Open)',
      click: () => {
        const updated = settingsStore.saveSettings({ position: { pinned: !isPinned } });
        broadcastToDocks('settings-changed', updated);
        if (!isPinned) showDock();
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    ...displayMenuItems,
    {
      label: 'Dock Position',
      submenu: [
        {
          label: 'Top Bar Dock',
          type: 'radio',
          checked: (settings.position?.mode || 'top') === 'top',
          click: () => {
            const updated = settingsStore.saveSettings({ position: { mode: 'top' } });
            syncDockWindows();
            broadcastToDocks('settings-changed', updated);
            showDock();
            updateTrayMenu();
          },
        },
        {
          label: 'Left Sidebar',
          type: 'radio',
          checked: settings.position?.mode === 'left',
          click: () => {
            const updated = settingsStore.saveSettings({ position: { mode: 'left' } });
            syncDockWindows();
            broadcastToDocks('settings-changed', updated);
            showDock();
            updateTrayMenu();
          },
        },
        {
          label: 'Right Sidebar',
          type: 'radio',
          checked: settings.position?.mode === 'right',
          click: () => {
            const updated = settingsStore.saveSettings({ position: { mode: 'right' } });
            syncDockWindows();
            broadcastToDocks('settings-changed', updated);
            showDock();
            updateTrayMenu();
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Open Spotify App',
      click: () => {
        shell.openExternal('spotify:');
      },
    },
    { type: 'separator' },
    ...getUpdateTrayMenuItems(),
    { type: 'separator' },
    { label: 'Quit', click: () => quitApp() },
  ]);
}

function getUpdateTrayMenuItems() {
  const status = updateService.getStatus();
  if (status.state === 'downloaded') {
    return [
      {
        label: `✓ Restart to Update (v${status.version || ''})`,
        click: () => updateService.quitAndInstall(),
      },
    ];
  }
  if (status.state === 'downloading') {
    return [
      {
        label: `Downloading update (${status.percent}%)...`,
        enabled: false,
      },
    ];
  }
  if (status.state === 'available') {
    return [
      {
        label: `Update Available (v${status.version})`,
        click: () => updateService.downloadUpdate(),
      },
    ];
  }
  if (status.state === 'checking') {
    return [
      {
        label: 'Checking for updates...',
        enabled: false,
      },
    ];
  }
  return [
    {
      label: 'Check for Updates...',
      click: () => updateService.checkForUpdates(true),
    },
  ];
}

function updateTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const whiteLogoPath = path.join(__dirname, 'assets', 'k-logo-white.png');
  const blackLogoPath = path.join(__dirname, 'assets', 'k-logo-black.png');
  let iconPath = fs.existsSync(trayIconPath) ? trayIconPath : (fs.existsSync(whiteLogoPath) ? whiteLogoPath : (fs.existsSync(blackLogoPath) ? blackLogoPath : null));
  if (!iconPath && !fs.existsSync(fallbackPath)) {
    const assetsDir = path.join(__dirname, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBzVMKoBBQMMAwz/Gf4z/Gf8z8jAwMTAwMTAwMTAwMTAwMTAwAAAohIHf2R0d3MAAAAASUVORK5CYII=';
    fs.writeFileSync(fallbackPath, Buffer.from(iconBase64, 'base64'));
  }
  if (!iconPath) iconPath = fallbackPath;
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBzVMKoBBQMMAwz/Gf4z/Gf8z8jAwMTAwMTAwMTAwMTAwMTAwAAAohIHf2R0d3MAAAAASUVORK5CYII=');
  }
  // Windows tray needs a small icon (16x16) or it may not show
  const size = process.platform === 'win32' ? 16 : 22;
  const resized = icon.getSize().width > size ? icon.resize({ width: size, height: size }) : icon;
  tray = new Tray(resized.isEmpty() ? icon : resized);
  tray.setToolTip('ksync (Ctrl+Alt+S to toggle)');
  tray.setContextMenu(buildTrayMenu());

  tray.on('click', () => {
    if (isVisible) hideDock();
    else showDock();
  });
}

process.on('uncaughtException', (err) => {
  console.error('[Fatal]', err);
});

app.whenReady().then(() => {
  startSmtcSidecar();
  createWindow();
  createTray();

  try {
    globalShortcut.register('CommandOrControl+Alt+S', () => {
      if (isVisible) hideDock();
      else showDock();
    });
    console.log('[Main] Hotkey Ctrl+Alt+S registered');

    globalShortcut.register('CommandOrControl+Shift+M', () => {
      toggleCompactMode();
    });
    console.log('[Main] Hotkey Ctrl+Shift+M registered for Compact Dynamic Island Mode');
  } catch (err) {
    console.warn('[Main] Failed to register global shortcut:', err.message);
  }
}).catch((err) => {
  console.error('[App ready error]', err);
});

function quitApp() {
  if (app.isQuiting) return;
  console.log('[Main] Quitting ksync application completely...');
  app.isQuiting = true;

  // 1. Destroy tray icon immediately so it vanishes from Windows notification area
  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy();
      tray = null;
    } catch (_) {}
  }

  // 2. Unregister all global shortcuts
  try {
    globalShortcut.unregisterAll();
  } catch (_) {}

  // 3. Destroy RPC and child processes
  if (discordRPC) {
    try { discordRPC.destroy(); } catch (_) {}
  }
  if (smtcProcess) {
    try { smtcProcess.kill(); } catch (_) {}
    smtcProcess = null;
  }

  // 4. Destroy all open windows immediately
  for (const win of dockWindowsMap.values()) {
    if (win && !win.isDestroyed()) {
      try { win.destroy(); } catch (_) {}
    }
  }
  dockWindowsMap.clear();

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    try { settingsWindow.destroy(); } catch (_) {}
    settingsWindow = null;
  }

  if (peekWindow && !peekWindow.isDestroyed()) {
    try { peekWindow.destroy(); } catch (_) {}
    peekWindow = null;
  }

  // 5. Exit application process cleanly
  try {
    app.quit();
  } catch (_) {}

  setTimeout(() => {
    try {
      process.exit(0);
    } catch (_) {}
  }, 150);
}

app.on('window-all-closed', () => {
  if (app.isQuiting) {
    quitApp();
    return;
  }
  console.log('[Main] window-all-closed – recreating window in 1s');
  mainWindow = null;
  setTimeout(() => {
    if (!mainWindow && !app.isQuiting) {
      createWindow();
    }
  }, 1000);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit
app.on('before-quit', () => {
  quitApp();
});
