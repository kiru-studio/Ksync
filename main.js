const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let isVisible = false;
let hideTimeout;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: width,
    height: 120,
    x: 0,
    y: -120, // Start just above the screen
    frame: false,
    transparent: true,
    alwaysOnTop: false, // Changed to false to prevent blocking
    resizable: false,
    skipTaskbar: true,
    focusable: false, // Prevent focus stealing
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

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
    } else if (mouseY > 120 && isVisible && !isHovering) {
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
    if (isVisible && mouseY > 120) {
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
    mainWindow.setPosition(0, 0);
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
      mainWindow.setPosition(0, -120); // Move just above the screen
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
