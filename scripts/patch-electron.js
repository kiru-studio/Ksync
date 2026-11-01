/**
 * Brands node_modules/electron/dist/electron.exe so that Task Manager,
 * Alt-Tab, and Taskbar show the ksync logo and name even in dev mode (npm start).
 */
const path = require('path');
const fs = require('fs');
const { rcedit } = require('rcedit');

async function patch() {
  if (process.platform !== 'win32') return;

  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');

  if (!fs.existsSync(icoPath)) {
    console.log('[patch-electron] icon.ico not found, building icons first...');
    require('../build-icon.js');
  }

  if (!fs.existsSync(electronExe)) {
    console.warn('[patch-electron] electron.exe not found at:', electronExe);
    return;
  }

  try {
    await rcedit(electronExe, {
      'icon': icoPath,
      'version-string': {
        'ProductName': 'ksync',
        'FileDescription': 'ksync',
        'InternalName': 'ksync',
        'CompanyName': 'Kiruthik Kumar M',
        'LegalCopyright': 'Copyright © 2026 Kiruthik Kumar M',
      },
    });
    console.log('[patch-electron] Successfully patched electron.exe with ksync logo and metadata!');
  } catch (err) {
    if (err.message && err.message.includes('locked')) {
      console.warn('[patch-electron] electron.exe is currently running (skipped patch)');
    } else {
      console.warn('[patch-electron] Patch skipped:', err.message);
    }
  }
}

patch();
