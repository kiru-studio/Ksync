const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
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

  mainWindow = new BrowserWindow({
    width: scaledWidth,
    height: scaledHeight,
    x: 0,
    y: -scaledHeight, // Start just above the screen
    frame: false,
    transparent: true,
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
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

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
    }, 300); // Small delay to prevent flickering
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
