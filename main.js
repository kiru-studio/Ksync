const { app, BrowserWindow, screen, ipcMain, Tray, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Avoid Windows "Unable to create cache" / "Gpu Cache Creation failed" errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const tokenStore = require(path.join(__dirname, 'src', 'utils', 'tokenStore.js'));
const SpotifyAuth = require(path.join(__dirname, 'src', 'services', 'SpotifyAuth.js'));
const SpotifyAPI = require(path.join(__dirname, 'src', 'services', 'SpotifyAPI.js'));
const config = require(path.join(__dirname, 'config.js'));

const spotifyConfig = {
  clientId: config.spotify?.clientId || config.SPOTIFY_CLIENT_ID || '',
  redirectUri: config.spotify?.redirectUri || config.REDIRECT_URI || 'http://127.0.0.1:8888/callback',
};

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

function normalizeQueue(body) {
  if (!body) return { items: [] };
  const queue = body.queue || [];
  const seen = new Set();
  const unique = [];
  for (const track of queue) {
    if (unique.length >= 4) break;
    const id = track.id || track.uri;
    if (id && !seen.has(id)) {
      seen.add(id);
      unique.push(track);
    }
  }
  const items = unique.map((track) => ({
    id: track.id,
    uri: track.uri,
    title: track.name,
    artist: (track.artists || []).map((a) => a.name).join(', '),
    albumArt: track.album?.images?.[0]?.url,
  }));
  return { items, source: 'queue' };
}

let mainWindow;
let tray = null;
let last403Log = 0;
const DOCK_WIDTH = 3000; // CSS pixels
const DOCK_HEIGHT = 450; // CSS pixels
let deviceScaleFactor = 1;
let scaledWidth = DOCK_WIDTH;
let scaledHeight = DOCK_HEIGHT;

// Force Chromium to use scale factor 1 so 1 CSS px == 1 device px (helps avoid Windows zoom)
app.commandLine.appendSwitch('force-device-scale-factor', '1');
// Ensure single instance (prevents multiple dock windows)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Main] Another instance is running, quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
let isVisible = false;
let hideTimeout;

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  deviceScaleFactor = primary.scaleFactor || 1;
  // Scale window size to device-independent pixels so full 3000xH CSS fits on high-DPI screens
  scaledWidth = Math.max(1, Math.round(DOCK_WIDTH / deviceScaleFactor));
  scaledHeight = Math.max(1, Math.round(DOCK_HEIGHT / deviceScaleFactor));
  console.log('[Dock DPI]', { deviceScaleFactor, workArea: primary.workAreaSize, scaledWidth, scaledHeight });

  try {
  mainWindow = new BrowserWindow({
    width: scaledWidth,
    height: scaledHeight,
    x: 0,
    y: -scaledHeight, // Start just above the screen
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // Fully transparent so no black band at top on Windows
    useContentSize: false, // Changed to false to use exact pixel dimensions
    alwaysOnTop: false, // Changed to false to prevent blocking
    resizable: false,
    maximizable: false,
    minimizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false, // Prevent focus stealing
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // set via setZoomFactor after creation based on deviceScaleFactor
      zoomFactor: 1.0,
    },
    autoHideMenuBar: true,
  });

  // Match CSS pixels to requested DOCK_* by inversely scaling the webContents
  // Force CSS pixels to be 1:1 with our intended layout regardless of Windows scaling
  mainWindow.webContents.setZoomFactor(1 / deviceScaleFactor);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1 / deviceScaleFactor);
  });

  // Clamp bounds at creation regardless of DPI scaling
  mainWindow.setBounds({ x: 0, y: -scaledHeight, width: scaledWidth, height: scaledHeight }, true);
  mainWindow.setSize(scaledWidth, scaledHeight, false); // Force exact size

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Auto-hide functionality
  let mouseY = 0;
  let isHovering = false;

  // Monitor mouse position
  setInterval(() => {
    const mousePosition = screen.getCursorScreenPoint();
    mouseY = mousePosition.y;
    
    // Show dock when mouse is at top of screen
    if (mouseY <= 5 && !isVisible) {
      console.log('Mouse at top, showing dock. Mouse Y:', mouseY);
      showDock();
    } else if (mouseY > scaledHeight && isVisible && !isHovering) {
      console.log('Mouse moved away, hiding dock. Mouse Y:', mouseY);
      hideDock();
    }
  }, 100);

  // Make window ignore mouse events when hidden
  mainWindow.setIgnoreMouseEvents(true);

  // Handle mouse enter/leave events from renderer
  ipcMain.on('mouse-enter', () => {
    isHovering = true;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  });

  ipcMain.on('mouse-leave', () => {
    isHovering = false;
    if (isVisible && mouseY > DOCK_HEIGHT) {
      hideDock();
    }
  });

  // Prevent window from being closed
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      hideDock();
    }
  });

  // Spotify PKCE login
  ipcMain.handle('spotify-login', async () => {
    try {
      await SpotifyAuth.login(spotifyConfig, tokenStore);
      return { ok: true };
    } catch (err) {
      console.error('[main] Spotify login error:', err);
      return { ok: false, error: err.message || 'Login failed' };
    }
  });

  ipcMain.handle('spotify-has-tokens', () => tokenStore.hasTokens());

  ipcMain.on('spotify-logout', () => {
    tokenStore.clearTokens();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('spotify-logout-done');
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
      return normalizePlayerState(body);
    } catch (err) {
      log403Once(err);
      if (err.status === 204 || err.status === 404) return null;
      if (err.status === 401) throw new Error('Not authenticated');
      throw err;
    }
  });

  ipcMain.handle('spotify-get-queue', async () => {
    try {
      const body = await SpotifyAPI.getQueue(tokenStore, spotifyConfig);
      return normalizeQueue(body);
    } catch (err) {
      if (err.status === 401) throw new Error('Not authenticated');
      return { items: [] };
    }
  });

  ipcMain.handle('spotify-play', () => SpotifyAPI.play(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-play-track', (_, uri) =>
    SpotifyAPI.play(tokenStore, spotifyConfig, uri ? { uris: [uri] } : {})
  );
  ipcMain.handle('spotify-pause', () => SpotifyAPI.pause(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-skip-next', () => SpotifyAPI.skipNext(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-skip-previous', () => SpotifyAPI.skipPrevious(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-set-volume', (_, volume) => SpotifyAPI.setVolume(tokenStore, spotifyConfig, volume));
  ipcMain.handle('spotify-seek', (_, positionMs) => SpotifyAPI.seek(tokenStore, spotifyConfig, positionMs));
  ipcMain.handle('spotify-set-shuffle', (_, state) => SpotifyAPI.setShuffle(tokenStore, spotifyConfig, state));
  ipcMain.handle('spotify-set-repeat', (_, state) => SpotifyAPI.setRepeat(tokenStore, spotifyConfig, state));
  ipcMain.handle('spotify-get-current-user', () => SpotifyAPI.getCurrentUser(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-get-devices', () => SpotifyAPI.getDevices(tokenStore, spotifyConfig));
  ipcMain.handle('spotify-transfer-playback', (_, deviceIds, play) =>
    SpotifyAPI.transferPlayback(tokenStore, spotifyConfig, deviceIds, play)
  );

  mainWindow.on('closed', () => {
    console.log('[Main] Window closed');
    mainWindow = null;
  });

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[Main] Renderer crashed:', details.reason, details.exitCode);
  });

  mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => {
    console.error('[Main] Load failed:', code, desc, url);
  });

  } catch (err) {
    console.error('[Main] createWindow error:', err);
    throw err;
  }
}

function showDock() {
  if (!isVisible) {
    isVisible = true;
    console.log('Showing dock...');
    mainWindow.setAlwaysOnTop(true); // Make it top when visible
    mainWindow.setIgnoreMouseEvents(false); // Allow mouse events when visible
    mainWindow.setOpacity(1); // Make fully visible
    // Force exact dimensions and position (no DPI scaling side-effects)
    mainWindow.setBounds({ x: 0, y: 0, width: scaledWidth, height: scaledHeight }, true);
    mainWindow.setSize(scaledWidth, scaledHeight, false); // Force exact size
    mainWindow.show(); // Ensure window is shown
    mainWindow.webContents.send('dock-visible', true);
    updateTrayMenu();
  }
}

function hideDock() {
  if (isVisible) {
    hideTimeout = setTimeout(() => {
      isVisible = false;
      console.log('Hiding dock...');
      mainWindow.setAlwaysOnTop(false); // Remove from top when hidden
      mainWindow.setIgnoreMouseEvents(true); // Ignore mouse events when hidden
      mainWindow.setOpacity(0); // Make completely transparent
      mainWindow.setPosition(0, -scaledHeight); // Move just above the screen
      mainWindow.webContents.send('dock-visible', false);
      updateTrayMenu();
    }, 300); // Small delay to prevent flickering
  }
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide dock' : 'Show dock',
      click: () => {
        if (isVisible) hideDock();
        else showDock();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
}

function updateTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  const logoPath = path.join(__dirname, 'Untitled_design__1_-removebg-preview.png');
  const fallbackPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let iconPath = fs.existsSync(logoPath) ? logoPath : null;
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
  tray = new Tray(icon);
  tray.setToolTip('Spotiffy Dock');
  tray.setContextMenu(buildTrayMenu());
}

process.on('uncaughtException', (err) => {
  console.error('[Fatal]', err);
});

app.whenReady().then(() => {
  createWindow();
  createTray();
}).catch((err) => {
  console.error('[App ready error]', err);
});

app.on('window-all-closed', () => {
  console.log('[Main] window-all-closed – recreating window in 1s');
  mainWindow = null;
  // Recreate window so app keeps running (e.g. after renderer crash)
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
  app.isQuiting = true;
});
