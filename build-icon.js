/**
 * Converts the app logo PNG to standard multi-resolution Windows .ico (16, 24, 32, 48, 64, 128, 256)
 * with PNG compression for 256x256, fully compatible with Windows 10/11 Taskbar, Alt-Tab, and Task Manager.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const brandedPng = path.join(__dirname, 'assets', 'app-icon.png');
const fallbackPng = path.join(__dirname, 'Untitled_design__1_-removebg-preview.png');
const pngPath = fs.existsSync(brandedPng) ? brandedPng : fallbackPng;

const outDir = path.join(__dirname, 'build');
const icoPath = path.join(outDir, 'icon.ico');
const instIco = path.join(outDir, 'installerIcon.ico');
const uninstIco = path.join(outDir, 'uninstallerIcon.ico');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate multi-resolution Windows .ico with Python Pillow
const pyScript = `
from PIL import Image
import sys

src = sys.argv[1]
ico_out = sys.argv[2]
inst_out = sys.argv[3]
uninst_out = sys.argv[4]

img = Image.open(src)
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(ico_out, format='ICO', sizes=sizes)
img.save(inst_out, format='ICO', sizes=sizes)
img.save(uninst_out, format='ICO', sizes=sizes)
print(f"[build-icon] Successfully generated standard multi-resolution ICO: {ico_out}")
`;

const res = spawnSync('python', ['-c', pyScript, pngPath, icoPath, instIco, uninstIco], {
  encoding: 'utf8',
});

if (res.status === 0) {
  console.log(res.stdout.trim());
} else {
  console.warn('[build-icon] Python generation fallback to png-to-ico:', res.stderr);
  const pngToIco = require('png-to-ico');
  pngToIco(pngPath)
    .then((buf) => {
      fs.writeFileSync(icoPath, buf);
      fs.writeFileSync(instIco, buf);
      fs.writeFileSync(uninstIco, buf);
      console.log('[build-icon] Written', icoPath, '+ installer/uninstaller icons via png-to-ico');
    })
    .catch((err) => {
      console.error('[build-icon] Failed:', err.message);
    });
}
