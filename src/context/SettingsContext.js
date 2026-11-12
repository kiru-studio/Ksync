import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SettingsContext = createContext(null);

export const DEFAULT_SETTINGS = {
  version: '2.5.2',
  position: {
    mode: 'top',
    style: 'full',
    pinned: false,
    islandShape: 'square',
    height: 190,
    sidebarWidth: 340,
    islandWidth: 1180,
    islandSize: 320,
    triggerDistance: 1,
    triggerSpan: 'full',
    targetDisplay: 'all',
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

export const PRESET_THEMES = [
  {
    id: 'custom',
    name: 'Custom',
    backdropStyle: 'acrylic',
    solidColor: '#0b0d12',
    gradient: { angle: 135, color1: '#161922', color2: '#090a0e', stops: [{ color: '#161922', pos: 0 }, { color: '#090a0e', pos: 100 }] },
    opacity: 0.92,
    blurStrength: 24,
    panelOpacity: 0.95,
    panelBlur: 16,
    accentColor: '#1db954',
    accentSecondary: '#00e676',
    lyricsActiveColor: '#1db954',
    lyricsGlowColor: '#1db954',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#94a3b8',
    surfacePrimary: '#101216',
    surfaceElevated: '#14171c',
    appBackground: '#050608',
  },
  {
    id: 'oled',
    name: 'OLED Pure Black',
    backdropStyle: 'solid',
    solidColor: '#000000',
    gradient: { angle: 180, color1: '#000000', color2: '#050505', stops: [{ color: '#000000', pos: 0 }, { color: '#050505', pos: 100 }] },
    opacity: 1.0,
    blurStrength: 0,
    panelOpacity: 1.0,
    panelBlur: 0,
    borderOpacity: 10,
    borderColor: '#222222',
    accentColor: '#00e676',
    accentSecondary: '#10b981',
    lyricsActiveColor: '#00e676',
    lyricsGlowColor: '#00e676',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#808080',
    surfacePrimary: '#000000',
    surfaceElevated: '#080808',
    appBackground: '#000000',
  },
  {
    id: 'frosted',
    name: 'Frosted Glass 11',
    backdropStyle: 'acrylic',
    solidColor: '#1e2230',
    gradient: { angle: 135, color1: '#282f44', color2: '#131722', stops: [{ color: '#282f44', pos: 0 }, { color: '#131722', pos: 100 }] },
    opacity: 0.68,
    blurStrength: 38,
    panelOpacity: 0.75,
    panelBlur: 24,
    glassSaturation: 140,
    accentColor: '#60a5fa',
    accentSecondary: '#38bdf8',
    lyricsActiveColor: '#93c5fd',
    lyricsGlowColor: '#60a5fa',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#cbd5e1',
    surfacePrimary: '#151b26',
    surfaceElevated: '#1c2433',
    appBackground: '#0b0f17',
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyberpunk',
    backdropStyle: 'gradient',
    solidColor: '#130424',
    gradient: { angle: 120, color1: '#2e0854', color2: '#090014', stops: [{ color: '#38006b', pos: 0 }, { color: '#090014', pos: 100 }] },
    opacity: 0.94,
    blurStrength: 28,
    panelOpacity: 0.92,
    panelBlur: 18,
    accentColor: '#ec4899',
    accentSecondary: '#f43f5e',
    lyricsActiveColor: '#f43f5e',
    lyricsGlowColor: '#ec4899',
    textColorPrimary: '#fdf4ff',
    textColorSecondary: '#d8b4fe',
    surfacePrimary: '#160526',
    surfaceElevated: '#200836',
    appBackground: '#090014',
  },
  {
    id: 'warm-amber',
    name: 'Warm Sunset',
    backdropStyle: 'gradient',
    solidColor: '#1a0d0a',
    gradient: { angle: 140, color1: '#38160d', color2: '#120703', stops: [{ color: '#4a1b0b', pos: 0 }, { color: '#140602', pos: 100 }] },
    opacity: 0.92,
    blurStrength: 22,
    panelOpacity: 0.94,
    panelBlur: 16,
    accentColor: '#f97316',
    accentSecondary: '#fb923c',
    lyricsActiveColor: '#fb923c',
    lyricsGlowColor: '#f97316',
    textColorPrimary: '#fff7ed',
    textColorSecondary: '#fdba74',
    surfacePrimary: '#1c0d08',
    surfaceElevated: '#26120b',
    appBackground: '#0d0503',
  },
  {
    id: 'artwork',
    name: 'Artwork Reactive',
    backdropStyle: 'artwork',
    solidColor: '#0c0d12',
    gradient: { angle: 135, color1: '#181a24', color2: '#08090d', stops: [{ color: '#181a24', pos: 0 }, { color: '#08090d', pos: 100 }] },
    opacity: 0.88,
    blurStrength: 30,
    panelOpacity: 0.92,
    panelBlur: 20,
    artworkSampling: true,
    vignetteIntensity: 50,
    accentColor: '#38bdf8',
    accentSecondary: '#0ea5e9',
    lyricsActiveColor: 'dynamic',
    lyricsGlowColor: 'dynamic',
    textColorPrimary: '#ffffff',
    textColorSecondary: '#94a3b8',
    surfacePrimary: '#101216',
    surfaceElevated: '#14171c',
    appBackground: '#050608',
  },
];

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '29, 185, 84';
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return '29, 185, 84';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Apply settings to document CSS variables (Live Preview Engine)
  const applyCssVariables = useCallback((s) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const theming = s.theming || DEFAULT_SETTINGS.theming;
    const position = s.position || DEFAULT_SETTINGS.position;

    // 1. Background Fill Matrix
    if (theming.backdropStyle === 'solid') {
      root.style.setProperty('--dock-backdrop-bg', theming.solidColor || '#0c0e14');
    } else if (theming.backdropStyle === 'gradient') {
      const g = theming.gradient || { angle: 135, color1: '#181b29', color2: '#0b0c13' };
      const stops = g.stops && g.stops.length >= 2
        ? g.stops.map((st) => `${st.color} ${st.pos}%`).join(', ')
        : `${g.color1} 0%, ${g.color2} 100%`;
      root.style.setProperty('--dock-backdrop-bg', `linear-gradient(${g.angle || 135}deg, ${stops})`);
    } else if (theming.backdropStyle === 'radial') {
      const r = theming.radialGradient || { color1: '#1f2438', color2: '#08090d' };
      root.style.setProperty('--dock-backdrop-bg', `radial-gradient(circle at 50% 50%, ${r.color1}, ${r.color2})`);
    } else if (theming.backdropStyle === 'mesh') {
      const acc = theming.accentColor || '#1db954';
      const sec = theming.accentSecondary || '#00e676';
      root.style.setProperty(
        '--dock-backdrop-bg',
        `radial-gradient(at 0% 0%, ${acc}30 0px, transparent 55%), radial-gradient(at 100% 100%, ${sec}25 0px, transparent 55%), #0c0e14`
      );
    } else if (theming.backdropStyle === 'acrylic') {
      root.style.setProperty(
        '--dock-backdrop-bg',
        theming.solidColor ? `${theming.solidColor}e6` : 'rgba(12, 14, 20, 0.90)'
      );
    }

    const isArtworkBackdrop = theming.backdropStyle === 'artwork' || theming.preset === 'artwork';
    if (isArtworkBackdrop) {
      const op = theming.opacity ?? 0.88;
      const artOpacity = Math.max(0.12, Math.min(0.75, op * 0.42));
      root.style.setProperty('--dock-art-opacity', String(artOpacity));
      root.style.setProperty('--dock-backdrop-bg', 'rgba(10, 12, 16, 0.78)');
      root.style.setProperty('--dock-scrim-bg', `rgba(10, 12, 16, ${Math.max(0.40, Math.min(0.88, 1 - op * 0.35))})`);
    } else {
      root.style.setProperty('--dock-art-opacity', '0');
    }

    // 2. Glass & Materials System
    const opacityVal = theming.opacity ?? 0.92;
    const blurVal = theming.blurStrength ?? (isArtworkBackdrop ? 50 : 24);
    root.style.setProperty('--dock-opacity', String(opacityVal));
    root.style.setProperty('--dock-blur', `${blurVal}px`);
    root.style.setProperty('--panel-opacity', String(theming.panelOpacity ?? 0.95));
    root.style.setProperty('--panel-blur', `${theming.panelBlur ?? 16}px`);
    root.style.setProperty('--dock-corner-radius', `${theming.cornerRadius ?? 24}px`);
    root.style.setProperty('--dock-border-radius', `${theming.cornerRadius ?? 24}px`);
    root.style.setProperty('--border-opacity', `${(theming.borderOpacity ?? 12) / 100}`);
    root.style.setProperty(
      '--panel-border-color',
      `rgba(${hexToRgb(theming.borderColor || '#ffffff')}, ${(theming.borderOpacity ?? 12) / 100})`
    );
    root.style.setProperty('--glass-saturation', `${theming.glassSaturation ?? 120}%`);
    root.style.setProperty(
      '--dock-shadow',
      `0 8px ${theming.shadowBlur ?? 24}px ${theming.shadowSpread ?? 4}px rgba(0, 0, 0, ${(theming.shadowIntensity ?? 65) / 100})`
    );

    // 3. Global Color System
    const isOled = theming.preset === 'oled' || (theming.backdropStyle === 'solid' && (theming.solidColor === '#000000' || theming.solidColor === '#000'));
    root.classList.toggle('mode-oled', !!isOled);
    root.classList.toggle('hide-art-ripples', theming.albumArtRipples === false);
    root.classList.toggle('hide-art-glow', theming.albumArtGlow === false);

    const appBg = theming.appBackground || (isOled ? '#000000' : '#050608');
    const surfPri = theming.surfacePrimary || (isOled ? '#000000' : '#101216');
    const surfElev = theming.surfaceElevated || (isOled ? '#080808' : '#14171c');
    const primaryText = theming.textColorPrimary || '#ffffff';
    const secondaryText = theming.textColorSecondary || '#94a3b8';
    const mutedText = theming.textMuted || '#52525b';
    const accent = theming.accentColor || '#1db954';
    const accentSecondary = theming.accentSecondary || '#00e676';

    root.style.setProperty('--app-background', appBg);
    root.style.setProperty('--surface-primary', surfPri);
    root.style.setProperty('--surface-elevated', surfElev);
    root.style.setProperty('--text-primary', primaryText);
    root.style.setProperty('--text-secondary', secondaryText);
    root.style.setProperty('--text-muted', mutedText);
    root.style.setProperty('--dock-text-primary', primaryText);
    root.style.setProperty('--dock-text-secondary', secondaryText);

    // Check if Artwork Reactive mode is active and if an extracted accent is cached
    const isArtworkReactive = (theming.backdropStyle === 'artwork' || theming.preset === 'artwork') && theming.artworkSampling !== false;
    let cachedAccent = null;
    if (isArtworkReactive) {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        try {
          const params = new URLSearchParams(window.location.search);
          const qHex = params.get('accent');
          if (qHex) {
            cachedAccent = {
              hex: qHex,
              rgb: params.get('rgb') || '',
              soft: params.get('soft') || '',
              glow: params.get('glow') || '',
            };
          }
        } catch (_) {}
      }
      if (!cachedAccent && typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem('ksync_last_accent');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.hex) cachedAccent = parsed;
          }
        } catch (_) {}
      }
    }

    if (cachedAccent) {
      root.style.setProperty('--accent', cachedAccent.hex);
      if (cachedAccent.rgb) root.style.setProperty('--accent-rgb', cachedAccent.rgb);
      if (cachedAccent.soft) root.style.setProperty('--accent-soft', cachedAccent.soft);
      if (cachedAccent.glow) root.style.setProperty('--accent-glow', cachedAccent.glow);
      root.style.setProperty('--progress-color', cachedAccent.hex);
    } else {
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-rgb', hexToRgb(accent));
      root.style.setProperty('--accent-soft', isOled ? 'transparent' : `${accent}26`);
      root.style.setProperty('--accent-glow', `${accent}59`);
      root.style.setProperty('--progress-color', theming.progressColor || accent);
    }

    root.style.setProperty('--accent-secondary', accentSecondary);
    root.style.setProperty('--icon-color', theming.iconColor || secondaryText);
    root.style.setProperty('--border-subtle', theming.borderSubtle || 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--divider-color', theming.dividerColor || 'rgba(255, 255, 255, 0.08)');

    // 4. Karaoke & Typography
    const isDynamicLyrics = theming.lyricsActiveColor === 'dynamic' || (!theming.lyricsActiveColor && isArtworkReactive);
    if (isDynamicLyrics && cachedAccent) {
      root.style.setProperty('--dock-lyrics-active', cachedAccent.hex);
      root.style.setProperty('--dock-lyrics-active-glow', cachedAccent.glow || cachedAccent.hex);
    } else {
      const activeLyricsColor = isDynamicLyrics ? 'var(--accent)' : (theming.lyricsActiveColor || '#1db954');
      const lyricsGlowColor = isDynamicLyrics ? 'var(--accent-glow, var(--accent))' : (theming.lyricsGlowColor || activeLyricsColor);
      root.style.setProperty('--dock-lyrics-active', activeLyricsColor);
      root.style.setProperty('--dock-lyrics-active-glow', lyricsGlowColor);
    }
    root.style.setProperty('--dock-lyrics-glow-radius', `${theming.lyricsGlowRadius ?? 20}px`);
    root.style.setProperty('--dock-lyrics-glow-spread', `${theming.lyricsGlowSpread ?? 4}px`);
    root.style.setProperty(
      '--dock-lyrics-inactive',
      theming.lyricsColor === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)'
    );
    root.style.setProperty('--dock-lyrics-font-family', theming.lyricsFontFamily || 'system-ui');
    root.style.setProperty('--dock-lyrics-font-size', `${theming.lyricsFontSize ?? 20}px`);
    root.style.setProperty('--dock-lyrics-font-weight', String(theming.lyricsFontWeight ?? 700));
    root.style.setProperty('--dock-lyrics-line-height', String(theming.lyricsLineHeight ?? 1.45));
    root.style.setProperty('--dock-lyrics-letter-spacing', `${theming.lyricsLetterSpacing ?? 0}px`);
    root.style.setProperty('--dock-lyrics-align', theming.lyricsAlign || 'center');
    root.style.setProperty('--dock-lyrics-scale', String(theming.lyricsScale ?? 1.04));
    root.style.setProperty('--dock-lyrics-transition', `${theming.lyricsTransitionMs ?? 320}ms`);
    root.style.setProperty('--dock-lyrics-fade', String((theming.lyricsFadeIntensity ?? 35) / 100));

    // Custom Font Injection
    if (theming.customFont?.name && theming.customFont?.data) {
      let fontStyleEl = document.getElementById('ksync-custom-font');
      if (!fontStyleEl) {
        fontStyleEl = document.createElement('style');
        fontStyleEl.id = 'ksync-custom-font';
        document.head.appendChild(fontStyleEl);
      }
      const formatHint = theming.customFont.format ? `format('${theming.customFont.format}')` : '';
      fontStyleEl.textContent = `
        @font-face {
          font-family: '${theming.customFont.name}';
          src: url('${theming.customFont.data}') ${formatHint};
          font-display: swap;
        }
      `;
    } else {
      const fontStyleEl = document.getElementById('ksync-custom-font');
      if (fontStyleEl) fontStyleEl.remove();
    }

    // 5. Component Overrides & Motion
    root.style.setProperty('--art-size', `${theming.artSize ?? 110}px`);
    root.style.setProperty('--art-corner-radius', `${theming.artCornerRadius ?? 10}px`);
    root.style.setProperty('--art-hover-scale', theming.artHoverZoom !== false ? '1.05' : '1.0');
    root.style.setProperty('--progress-height', `${theming.progressThickness ?? 4}px`);
    root.style.setProperty('--transition-duration', `${theming.transitionDurationMs ?? 250}ms`);
    root.style.setProperty(
      '--transition-easing',
      theming.transitionEasing === 'spring'
        ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        : 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    );

    // 6. Dock Framing Island Width & Shape
    if (position.style === 'island') {
      const isSquare = !position.islandShape || position.islandShape === 'square';
      const w = isSquare ? 480 : 680;
      const r = isSquare ? 24 : 20;
      root.style.setProperty('--dock-island-max-width', `${w}px`);
      root.style.setProperty('--dock-border-radius', `${r}px`);
    } else {
      root.style.setProperty('--dock-island-max-width', '100%');
      root.style.setProperty('--dock-border-radius', '0px');
    }
  }, []);

  // Initial load
  useEffect(() => {
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.getSettings) {
      api.getSettings().then((loaded) => {
        if (loaded) {
          setSettings(loaded);
          applyCssVariables(loaded);
        }
        setIsLoaded(true);
      });
    } else {
      applyCssVariables(DEFAULT_SETTINGS);
      setIsLoaded(true);
    }

    if (api && api.onSettingsChanged) {
      api.onSettingsChanged((updated) => {
        setSettings((prev) => {
          if (!prev) return updated;
          const themingChanged = JSON.stringify(prev.theming) !== JSON.stringify(updated.theming);
          const framingChanged =
            prev.position?.style !== updated.position?.style ||
            prev.position?.islandShape !== updated.position?.islandShape ||
            prev.position?.islandWidth !== updated.position?.islandWidth ||
            prev.position?.islandSize !== updated.position?.islandSize;
          if (themingChanged || framingChanged) {
            applyCssVariables(updated);
          }
          return updated;
        });
      });
    }
  }, [applyCssVariables]);

  const hasVisualThemingChanges = (p) => {
    if (!p) return false;
    if (p.theming) return true;
    if (p.position && ('style' in p.position || 'islandShape' in p.position || 'islandWidth' in p.position || 'islandSize' in p.position)) return true;
    return false;
  };

  const updateSettings = useCallback(
    async (partial) => {
      const isVisual = hasVisualThemingChanges(partial);
      setSettings((prev) => {
        const next = {
          ...prev,
          ...partial,
          position: { ...prev.position, ...(partial.position || {}) },
          layout: { ...prev.layout, ...(partial.layout || {}) },
          theming: {
            ...prev.theming,
            ...(partial.theming || {}),
            gradient: {
              ...(prev.theming?.gradient || {}),
              ...(partial.theming?.gradient || {}),
            },
            radialGradient: {
              ...(prev.theming?.radialGradient || {}),
              ...(partial.theming?.radialGradient || {}),
            },
          },
          behavior: { ...prev.behavior, ...(partial.behavior || {}) },
        };
        if (isVisual) {
          applyCssVariables(next);
        }
        return next;
      });

      const api = typeof window !== 'undefined' && window.electronAPI;
      if (api && api.saveSettings) {
        try {
          const res = await api.saveSettings(partial);
          if (res) {
            setSettings(res);
            if (isVisual) {
              applyCssVariables(res);
            }
          }
        } catch (err) {
          console.error('[SettingsContext] Save failed:', err);
        }
      }
    },
    [applyCssVariables]
  );

  const resetSettings = useCallback(async () => {
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.resetSettings) {
      const def = await api.resetSettings();
      setSettings(def);
      applyCssVariables(def);
    } else {
      setSettings(DEFAULT_SETTINGS);
      applyCssVariables(DEFAULT_SETTINGS);
    }
  }, [applyCssVariables]);

  const togglePin = useCallback(async () => {
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.togglePin) {
      const isPinned = await api.togglePin();
      setSettings((prev) => ({
        ...prev,
        position: { ...prev.position, pinned: isPinned },
      }));
      return isPinned;
    }
    return false;
  }, []);

  const setDockHeight = useCallback(
    async (h) => {
      const api = typeof window !== 'undefined' && window.electronAPI;
      if (api && api.setDockHeight) {
        const clamped = await api.setDockHeight(h);
        setSettings((prev) => ({
          ...prev,
          position: { ...prev.position, height: clamped },
        }));
        return clamped;
      }
    },
    []
  );

  const setSidebarWidth = useCallback(
    async (w) => {
      const api = typeof window !== 'undefined' && window.electronAPI;
      if (api && api.setSidebarWidth) {
        const clamped = await api.setSidebarWidth(w);
        setSettings((prev) => ({
          ...prev,
          position: { ...prev.position, sidebarWidth: clamped },
        }));
        return clamped;
      }
    },
    []
  );

  // All combined presets (built-in + user custom presets)
  const allPresets = [
    ...PRESET_THEMES,
    ...(settings.theming?.customPresets || []),
  ];

  const applyPreset = useCallback(
    (presetId) => {
      const targetId = presetId === 'default' ? 'custom' : presetId;
      const preset = allPresets.find((p) => p.id === targetId || (targetId === 'custom' && p.id === 'default'));
      if (!preset) return;

      const updatedTheming = {
        ...settings.theming,
        ...preset,
        preset: targetId,
      };

      updateSettings({ theming: updatedTheming });
    },
    [allPresets, settings.theming, updateSettings]
  );

  // Preset management: Save As Custom Preset
  const saveCustomPreset = useCallback(
    (name) => {
      const trimmed = (name || '').trim() || `Custom Preset ${Date.now().toString().slice(-4)}`;
      const newId = `custom-${Date.now()}`;
      const newPreset = {
        ...settings.theming,
        id: newId,
        name: trimmed,
        isCustom: true,
      };

      const updatedList = [...(settings.theming?.customPresets || []), newPreset];
      updateSettings({
        theming: {
          customPresets: updatedList,
          preset: newId,
        },
      });
      return newPreset;
    },
    [settings.theming, updateSettings]
  );

  // Duplicate an existing preset
  const duplicatePreset = useCallback(
    (presetId) => {
      const source = allPresets.find((p) => p.id === presetId);
      if (!source) return null;
      const newId = `custom-${Date.now()}`;
      const newPreset = {
        ...source,
        id: newId,
        name: `${source.name} (Copy)`,
        isCustom: true,
      };
      const updatedList = [...(settings.theming?.customPresets || []), newPreset];
      updateSettings({
        theming: {
          customPresets: updatedList,
          preset: newId,
        },
      });
      return newPreset;
    },
    [allPresets, settings.theming, updateSettings]
  );

  // Rename a custom preset
  const renameCustomPreset = useCallback(
    (presetId, newName) => {
      const trimmed = (newName || '').trim();
      if (!trimmed) return;
      const current = settings.theming?.customPresets || [];
      const updated = current.map((p) => (p.id === presetId ? { ...p, name: trimmed } : p));
      updateSettings({ theming: { customPresets: updated } });
    },
    [settings.theming, updateSettings]
  );

  // Delete a custom preset
  const deleteCustomPreset = useCallback(
    (presetId) => {
      const current = settings.theming?.customPresets || [];
      const updated = current.filter((p) => p.id !== presetId);
      const isCurrentActive = settings.theming?.preset === presetId;
      updateSettings({
        theming: {
          customPresets: updated,
          ...(isCurrentActive ? { preset: 'default' } : {}),
        },
      });
      if (isCurrentActive) {
        applyPreset('default');
      }
    },
    [settings.theming, updateSettings, applyPreset]
  );

  // Toggle favorite status of a preset
  const favoritePreset = useCallback(
    (presetId) => {
      const current = settings.theming?.favoritePresets || [];
      const isFav = current.includes(presetId);
      const updated = isFav ? current.filter((id) => id !== presetId) : [...current, presetId];
      updateSettings({ theming: { favoritePresets: updated } });
    },
    [settings.theming, updateSettings]
  );

  // Export Theme as JSON string
  const exportTheme = useCallback(
    (presetId) => {
      const targetPreset = allPresets.find((p) => p.id === presetId) || settings.theming;
      const payload = {
        app: 'ksync',
        version: '2.5.2',
        exportedAt: new Date().toISOString(),
        theme: targetPreset,
      };
      return JSON.stringify(payload, null, 2);
    },
    [allPresets, settings.theming]
  );

  // Import Theme from JSON string with schema validation
  const importTheme = useCallback(
    (jsonString) => {
      try {
        const parsed = JSON.parse(jsonString);
        const data = parsed.theme || parsed;
        if (!data || typeof data !== 'object') {
          return { success: false, error: 'Invalid JSON theme structure' };
        }

        const name = (data.name || 'Imported Theme').slice(0, 40);
        const imported = {
          ...data,
          id: `custom-import-${Date.now()}`,
          name: name,
          isCustom: true,
          backdropStyle: ['acrylic', 'solid', 'gradient', 'radial', 'artwork', 'mesh'].includes(data.backdropStyle)
            ? data.backdropStyle
            : (data.backdropStyle || 'acrylic'),
        };

        const updatedList = [...(settings.theming?.customPresets || []), imported];
        updateSettings({
          theming: {
            customPresets: updatedList,
            preset: imported.id,
            ...imported,
          },
        });
        return { success: true, preset: imported };
      } catch (err) {
        return { success: false, error: err.message || 'Malformed JSON' };
      }
    },
    [settings.theming, updateSettings]
  );

  // Restore built-in presets to factory defaults
  const restoreBuiltinPresets = useCallback(() => {
    applyPreset('default');
  }, [applyPreset]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoaded,
        updateSettings,
        resetSettings,
        togglePin,
        setDockHeight,
        setSidebarWidth,
        applyPreset,
        saveCustomPreset,
        duplicatePreset,
        renameCustomPreset,
        deleteCustomPreset,
        favoritePreset,
        importTheme,
        exportTheme,
        restoreBuiltinPresets,
        presets: allPresets,
        builtinPresets: PRESET_THEMES,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}

