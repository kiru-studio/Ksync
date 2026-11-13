/**
 * Persistent Settings Store for ksync.
 * Reads and writes user preferences to app's userData directory.
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = 'ksync-settings.json';

const DEFAULT_SETTINGS = {
  version: '2.5.3',
  audio: {
    lastSystemVolume: null,
    lastSystemMuted: false,
    lastSpotifyVolume: null,
  },
  position: {
    mode: 'top',               // 'top' | 'left' | 'right'
    style: 'full',             // 'full' | 'island'
    islandShape: 'square',     // 'square' | 'rectangle'
    pinned: false,             // When true, auto-hide is disabled
    height: 190,               // Top dock height in px
    sidebarWidth: 340,         // Left/Right sidebar width in px
    islandWidth: 1180,         // Legacy width in floating island mode
    islandSize: 320,           // Square Island dimension in px
    triggerDistance: 4,        // Distance in px to trigger dock reveal (1 = absolute edge only, 4 = standard, 15 = relaxed)
    triggerSpan: 'full',       // 'full' | 'center' | 'compact' | 'dock' | 'left' | 'right' | 'custom'
    triggerWidthPct: 60,       // Width in % of edge when using custom span (10% - 100%)
    triggerOffsetPct: 50,      // Offset/alignment in % (0% = Left, 50% = Center, 100% = Right)
    triggerDelayMs: 0,         // Dwell delay in ms required before reveal (0ms = instant, 150ms = brush shield)
    targetDisplay: 'all',      // 'all' | 'primary' | 'cursor' | displayId
  },
  layout: {
    showNowPlaying: true,
    showLyrics: true,
    showQueue: true,
    panelOrder: ['nowPlaying', 'lyrics', 'queue'],
    sectionRatios: [25, 50, 25],
    sidebarSectionRatios: [40, 20, 40],
  },
  theming: {
    preset: 'custom',
    customPresets: [],
    favoritePresets: [],

    // Section 2: Background & Artwork
    backdropStyle: 'acrylic',  // 'acrylic' | 'solid' | 'gradient' | 'radial' | 'artwork' | 'mesh'
    solidColor: '#0c0e14',
    gradient: {
      angle: 135,
      color1: '#181b29',
      color2: '#0b0c13',
      stops: [
        { color: '#181b29', pos: 0 },
        { color: '#0b0c13', pos: 100 },
      ],
    },
    radialGradient: {
      color1: '#1f2438',
      color2: '#08090d',
    },
    artworkSampling: true,
    artworkBlendMode: 'normal',
    vignetteIntensity: 40,
    artworkZoom: 105,
    artworkTransitions: true,

    // Section 3: Glass & Materials
    opacity: 0.92,
    blurStrength: 24,
    panelOpacity: 0.95,
    panelBlur: 16,
    glassTint: '#000000',
    glassTintOpacity: 25,
    glassSaturation: 120,
    borderOpacity: 12,
    borderColor: '#ffffff',
    cornerRadius: 14,
    shadowIntensity: 65,
    shadowBlur: 24,
    shadowSpread: 4,
    surfaceElevation: 'elevated',
    noiseTexture: false,

    // Section 4: Global Color System
    appBackground: '#050608',
    surfacePrimary: '#101216',
    surfaceElevated: '#14171c',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#94a3b8',
    textMuted: '#52525b',
    accentColor: '#1db954',
    accentSecondary: '#00e676',
    iconColor: '#a1a1aa',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    dividerColor: 'rgba(255, 255, 255, 0.08)',
    progressColor: '#1db954',
    sliderTrack: 'rgba(255, 255, 255, 0.16)',
    sliderThumb: '#ffffff',
    controlActive: '#1db954',
    controlHover: 'rgba(255, 255, 255, 0.12)',
    customSwatches: ['#1db954', '#00e676', '#10b981', '#06b6d4', '#60a5fa', '#a855f7', '#ec4899', '#f97316', '#eab308'],

    // Section 5: Karaoke & Typography
    lyricsColor: 'white',
    lyricsActiveColor: '#1db954',
    lyricsFontFamily: 'system-ui',
    customFont: null,
    lyricsFontSize: 20,
    lyricsFontWeight: 700,
    lyricsLineHeight: 1.45,
    lyricsLetterSpacing: 0,
    lyricsAlign: 'center',
    lyricsScale: 1.04,
    lyricsGlowColor: '#1db954',
    lyricsGlowIntensity: 75,
    lyricsGlowRadius: 20,
    lyricsGlowSpread: 4,
    lyricsTransitionMs: 320,
    lyricsFadeIntensity: 35,
    lyricsPulseAnim: true,
    lyricsWordHighlight: false,

    // Section 6: Player Components
    artSize: 110,
    artCornerRadius: 10,
    artShadowIntensity: 60,
    artHoverZoom: true,
    albumArtStyle: 'vinyl',
    albumArtRipples: true,
    albumArtGlow: true,
    titleSize: 'normal',
    marqueeScroll: true,
    controlButtonSize: 'normal',
    controlStyle: 'glowing',
    progressThickness: 4,
    progressGlowOnSeek: true,
    timestampVisibility: true,
    timestampFormat: 'standard',
    playlistRowDensity: 'comfortable',

    // Section 7: Motion & Effects
    transitionDurationMs: 250,
    transitionEasing: 'smooth',
    hoverTransitions: true,
    presetCrossfade: true,
    albumArtTransition: 'crossfade',
    reactiveGlow: true,
    animationIntensity: 'subtle',
    reducedMotion: false,
    performanceMode: false,

    // Section 8: Layout & Density
    uiDensity: 'balanced',
    componentSpacing: 14,
    panelPadding: 16,
  },
  behavior: {
    mouseWheelVolume: true,
    scrubWheel: true,
    autoHideDelay: '300ms',
    trackChangePeek: true,
    discordRPC: true,
    discordPartySync: true,
    discordClientId: '1565344513881411667',
    discordPublicKey: '830403cc06e95f9d1cd3ef64cb4e1eac37327e5a819b6aeca518cc020e8528f7',
    spotifyClientId: '',
    spotifyRedirectUri: 'http://127.0.0.1:8888/callback',
  },
};

function getSettingsPath() {
  const userData = app.getPath('userData');
  return path.join(userData, SETTINGS_FILE);
}

let cachedSettings = null;
let saveTimeout = null;

function deepMerge(target, source) {
  const output = { ...target };
  if (source && typeof source === 'object') {
    Object.keys(source).forEach((key) => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  return output;
}

function loadSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    const filePath = getSettingsPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      cachedSettings = deepMerge(DEFAULT_SETTINGS, parsed);
      // Migrate legacy 8px triggerDistance to 1px (exact edge reveal)
      if (cachedSettings.position && (cachedSettings.position.triggerDistance === 8 || cachedSettings.position.triggerDistance === undefined)) {
        cachedSettings.position.triggerDistance = 1;
      }
      // Migrate multi-display targetDisplay to 'all' so dock spans all available displays by default
      if (cachedSettings.position && (cachedSettings.position.targetDisplay === 'primary' || !cachedSettings.position.targetDisplay)) {
        cachedSettings.position.targetDisplay = 'all';
      }
      return cachedSettings;
    }
  } catch (err) {
    console.error('[SettingsStore] Failed to load settings:', err.message);
  }
  cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  return cachedSettings;
}

function saveSettings(partial) {
  const current = loadSettings();
  cachedSettings = deepMerge(current, partial);

  // Debounced write to avoid disk thrashing
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const filePath = getSettingsPath();
      fs.writeFileSync(filePath, JSON.stringify(cachedSettings, null, 2), 'utf8');
      console.log('[SettingsStore] Settings saved to disk');
    } catch (err) {
      console.error('[SettingsStore] Failed to write settings:', err.message);
    }
  }, 250);

  return cachedSettings;
}

function resetSettings() {
  cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  try {
    const filePath = getSettingsPath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('[SettingsStore] Failed to reset settings:', err.message);
  }
  return cachedSettings;
}

module.exports = {
  loadSettings,
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS,
};

