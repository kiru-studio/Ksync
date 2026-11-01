/**
 * Samples the dominant vibrant color from an album art image.
 * Tunes the color's lightness to 55-65% for ideal WCAG AA contrast against dark backgrounds.
 * Falls back to default Spotify green (#1db954) on error or grayscale images.
 */

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function toHex(n) {
  const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}

function getDefaultAccent(fallbackHex = '#38bdf8') {
  return {
    hex: fallbackHex,
    rgb: '56, 189, 248',
    soft: 'rgba(56, 189, 248, 0.16)',
    glow: 'rgba(56, 189, 248, 0.40)',
  };
}

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '56, 189, 248';
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num) || cleaned.length !== 6) return '56, 189, 248';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function formatAccent(r, g, b) {
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const rgb = `${r}, ${g}, ${b}`;
  return {
    hex,
    rgb,
    soft: `rgba(${rgb}, 0.16)`,
    glow: `rgba(${rgb}, 0.35)`,
  };
}

const colorCache = new Map();

export async function extractVibrantColor(imageUrl, fallbackHex = '#38bdf8') {
  if (!imageUrl) return getDefaultAccent(fallbackHex);
  if (colorCache.has(imageUrl)) return colorCache.get(imageUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve(getDefaultAccent(fallbackHex));
    }, 1500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 48; // downscaled for instant analysis
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;
        let bestColor = null;
        let maxScore = -1;
        let secondaryColor = null;
        let secondaryScore = -1;

        // Sample pixels with adaptive density
        for (let i = 0; i < imgData.length; i += 8) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue; // skip transparent

          const [h, s, l] = rgbToHsl(r, g, b);

          // Discard extreme black or blinding white
          if (l < 0.08 || l > 0.94) continue;

          // Highly saturated candidates
          if (s >= 0.18) {
            const score = s * 2.5 + (1 - Math.abs(l - 0.58));
            if (score > maxScore) {
              maxScore = score;
              bestColor = { h, s, l };
            }
          } else if (s >= 0.08) {
            // Secondary candidate for darker/subtle tinted covers (sepia, dark amber, vintage)
            const score = s * 2.0 + (1 - Math.abs(l - 0.5));
            if (score > secondaryScore) {
              secondaryScore = score;
              secondaryColor = { h, s, l };
            }
          }
        }

        const chosen = bestColor || secondaryColor;
        if (chosen) {
          // Tune lightness to 58-70% for optimal, luminous contrast on dark backgrounds
          const tunedL = Math.max(0.58, Math.min(chosen.l, 0.70));
          const tunedS = Math.max(chosen.s, 0.65);
          const [r, g, b] = hslToRgb(chosen.h, tunedS, tunedL);
          const result = formatAccent(r, g, b);
          colorCache.set(imageUrl, result);
          return resolve(result);
        }

        const fallback = getDefaultAccent(fallbackHex);
        colorCache.set(imageUrl, fallback);
        resolve(fallback);
      } catch (_) {
        resolve(getDefaultAccent(fallbackHex));
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(getDefaultAccent(fallbackHex));
    };

    img.src = imageUrl;
  });
}
