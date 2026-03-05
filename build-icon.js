/**
 * Converts the app logo PNG to Windows .ico for electron-builder.
 * Run before: npm run dist
 */
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const pngPath = path.join(__dirname, 'Untitled_design__1_-removebg-preview.png');
const outDir = path.join(__dirname, 'build');
const icoPath = path.join(outDir, 'icon.ico');

if (!fs.existsSync(pngPath)) {
  console.warn('[build-icon] Logo not found:', pngPath);
  process.exit(0);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

pngToIco(pngPath)
  .then((buf) => {
    fs.writeFileSync(icoPath, buf);
    fs.writeFileSync(path.join(outDir, 'installerIcon.ico'), buf);
    fs.writeFileSync(path.join(outDir, 'uninstallerIcon.ico'), buf);
    console.log('[build-icon] Written', icoPath, '+ installer/uninstaller icons');
  })
  .catch((err) => {
    console.error('[build-icon] Failed:', err.message);
    process.exit(1);
  });
