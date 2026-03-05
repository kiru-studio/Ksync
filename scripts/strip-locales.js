const fs = require('fs');
const path = require('path');

/** Keep only en-US locale to reduce app size (~15–25 MB). */
exports.default = async function (context) {
  const localesDir = path.join(context.appOutDir, 'locales');
  if (!fs.existsSync(localesDir)) return;

  const keep = ['en-US.pak'];
  const files = fs.readdirSync(localesDir);

  for (const file of files) {
    if (file.endsWith('.pak') && !keep.includes(file)) {
      try {
        fs.unlinkSync(path.join(localesDir, file));
      } catch (err) {
        console.warn('[strip-locales] Could not remove:', file, err.message);
      }
    }
  }
};
