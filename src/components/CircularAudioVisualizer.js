import React, { useEffect, useRef } from 'react';

/**
 * Parses CSS color string (hex or rgb) into { r, g, b }
 */
function parseColor(str, defaultColor = { r: 29, g: 185, b: 84 }) {
  if (!str) return defaultColor;
  str = str.trim();
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex.slice(0, 6), 16);
    if (isNaN(num)) return defaultColor;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }
  const rgbMatch = str.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  return defaultColor;
}

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
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const BAR_COUNT = 80; // 80 radial capsule bars matching circular audio spectrum reference

/**
 * Circular Audio Spectrum Visualizer
 * Accurately replicates the radial capsule spectrum visualizer around circular vinyl art,
 * pulsing dynamically to the track BPM with the active theme color palette.
 * Robustly maintains continuous animation and state across play/pause transitions.
 */
export default function CircularAudioVisualizer({
  isPlaying = false,
  progress = 0,
  bpm = 120,
  discRadius = 137.5, // 275px diameter / 2
  size,
  className = '',
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const barHeightsRef = useRef(new Float32Array(BAR_COUNT).fill(4.0));
  const isPlayingRef = useRef(isPlaying);
  const prevPlayingRef = useRef(isPlaying);
  const bpmRef = useRef(bpm || 120);
  const progressRef = useRef(progress || 0);
  const discRadiusRef = useRef(discRadius);

  useEffect(() => {
    discRadiusRef.current = discRadius;
  }, [discRadius]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    bpmRef.current = Math.max(60, Math.min(220, bpm || 120));
  }, [bpm]);

  useEffect(() => {
    progressRef.current = progress || 0;
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    let accumulatedBeatTime = progressRef.current || 0;
    let lastProgress = progressRef.current || 0;

    // Cache theme colors from CSS variables
    let cachedAccent = '#1db954';
    let cachedSecondary = '';
    let cachedRgb = '29, 185, 84';
    let colorCheckTimer = 0;
    let cachedDiscRadius = effectiveDiscR;

    const measureDiscRadius = () => {
      try {
        const parent = canvas.parentElement;
        const artCard = parent?.querySelector('.sidebar-art-card, .art-wrapper') ||
                        (parent?.classList.contains('art-wrapper') ? parent : null);
        if (artCard) {
          const measured = artCard.getBoundingClientRect().width / 2;
          if (measured > 25 && measured < 220) {
            cachedDiscRadius = measured;
          }
        }
      } catch (_) {}
    };

    const updateColors = () => {
      try {
        const rootStyle = getComputedStyle(document.documentElement);
        const acc = rootStyle.getPropertyValue('--accent').trim();
        const sec = rootStyle.getPropertyValue('--accent-secondary').trim();
        const rgb = rootStyle.getPropertyValue('--accent-rgb').trim();
        if (acc) cachedAccent = acc;
        if (sec) cachedSecondary = sec;
        if (rgb) cachedRgb = rgb;
      } catch (_) {}
    };
    updateColors();
    measureDiscRadius();

    window.addEventListener('resize', measureDiscRadius);

    const render = (now) => {
      const activePlaying = isPlayingRef.current;
      const wasPlaying = prevPlayingRef.current;

      // Handle pause -> play transition cleanly without delta-time jump
      if (activePlaying && !wasPlaying) {
        lastTime = now;
        accumulatedBeatTime = progressRef.current || accumulatedBeatTime;
      }
      prevPlayingRef.current = activePlaying;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Check colors and disc dimensions periodically (every 1s)
      colorCheckTimer += dt;
      if (colorCheckTimer > 1.0) {
        colorCheckTimer = 0;
        updateColors();
        measureDiscRadius();
      }

      // Sync with external seek or progress changes
      if (Math.abs(progressRef.current - lastProgress) > 0.6) {
        accumulatedBeatTime = progressRef.current;
        lastProgress = progressRef.current;
      }

      const effectiveBpm = bpmRef.current;
      const beatFreq = effectiveBpm / 60; // beats per second

      if (activePlaying) {
        accumulatedBeatTime += dt;
      }

      // High DPI support
      const dpr = window.devicePixelRatio || 1;
      const effectiveDiscR = discRadiusRef.current || discRadius;
      const isCompact = effectiveDiscR < 80;
      const displaySize = size || (isCompact ? 180 : 340);
      const neededW = Math.round(displaySize * dpr);
      const neededH = Math.round(displaySize * dpr);

      if (canvas.width !== neededW || canvas.height !== neededH) {
        canvas.width = neededW;
        canvas.height = neededH;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, displaySize, displaySize);

      const cx = displaySize / 2;
      const cy = displaySize / 2;

      // Accurately determine the inner radius from cached disc dimensions (0ms layout cost)
      const currentDiscRadius = cachedDiscRadius || effectiveDiscR;
      const rInner = currentDiscRadius + (isCompact ? 1.5 : 2.0); // Starts precisely along the outer rim of the rotating vinyl

      // Mathematical audio spectrum simulation driven by BPM and audio frequency harmonics
      const t = accumulatedBeatTime;
      // Primary Beat Phase (0 to 1 over one beat period)
      const beatPhase = (t * beatFreq) % 1;
      // Sharp attack, exponential decay kick drum hit
      const kick = Math.exp(-8.5 * beatPhase);

      // Secondary Snare/Hi-Hat Phase (offset by half a beat)
      const snarePhase = (beatPhase + 0.5) % 1;
      const snare = Math.exp(-10 * snarePhase);

      // Slower multi-bar wave envelope (4 beats = 1 bar)
      const barPhase = ((t * beatFreq) / 4) % 1;
      const swell = 0.5 + 0.5 * Math.sin(barPhase * Math.PI * 2);

      const heights = barHeightsRef.current;

      // Color scheme derived from the selected theme
      const primaryRgb = parseColor(cachedAccent, { r: 29, g: 185, b: 84 });
      const hslPrimary = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);

      // Top color: Luminous, high-brightness tint of the theme (matches top of reference video)
      const topHue = (hslPrimary.h + 20) % 360;
      const topColor = `hsl(${topHue}, ${Math.min(100, hslPrimary.s + 10)}%, ${Math.min(84, hslPrimary.l + 18)}%)`;
      // Side color: Pure theme accent
      const sideColor = `hsl(${hslPrimary.h}, ${hslPrimary.s}%, ${hslPrimary.l}%)`;
      // Bottom color: Harmonic secondary accent (cyan-to-magenta shift as in reference video)
      let bottomColor;
      if (cachedSecondary) {
        const secRgb = parseColor(cachedSecondary);
        const hslSec = rgbToHsl(secRgb.r, secRgb.g, secRgb.b);
        bottomColor = `hsl(${hslSec.h}, ${hslSec.s}%, ${hslSec.l}%)`;
      } else {
        const bottomHue = (hslPrimary.h + 130) % 360;
        bottomColor = `hsl(${bottomHue}, 100%, ${Math.max(52, hslPrimary.l)}%)`;
      }

      // 360-degree Conic Gradient matching the reference video's circular audio spectrum
      let strokeStyle;
      if (typeof ctx.createConicGradient === 'function') {
        const conic = ctx.createConicGradient(-Math.PI / 2, cx, cy);
        conic.addColorStop(0, topColor);
        conic.addColorStop(0.25, sideColor);
        conic.addColorStop(0.5, bottomColor);
        conic.addColorStop(0.75, sideColor);
        conic.addColorStop(1, topColor);
        strokeStyle = conic;
      } else {
        strokeStyle = cachedAccent;
      }

      const barCount = isCompact ? 64 : BAR_COUNT;
      const maxH = isCompact ? 13 : 24;
      const baseH = isCompact ? 2.5 : 4.0;
      const energyScale = isCompact ? 0.55 : 1.0;

      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = isCompact ? 2.2 : 3.2; // Rounded capsule bar thickness
      ctx.lineCap = 'round';

      // Soft tip bloom glow when active
      if (activePlaying) {
        ctx.shadowColor = `rgba(${cachedRgb}, 0.55)`;
        ctx.shadowBlur = isCompact ? 4 : 6;
      } else {
        ctx.shadowColor = `rgba(${cachedRgb}, 0.25)`;
        ctx.shadowBlur = 2;
      }

      for (let i = 0; i < barCount; i++) {
        // Uniform circular distribution
        const angle = (i / barCount) * (Math.PI * 2) - Math.PI / 2; // Starts from top (12 o'clock)
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        let targetH = baseH; // Base idle capsule dot length

        if (activePlaying) {
          // Bottom frequency band (Bass & Sub-bass): peaks on kick beats (sinA > 0)
          const bassWeight = Math.pow(Math.max(0, sinA), 1.7);
          // Top frequency band (Treble & Hi-hats): peaks on snare beats (sinA < 0)
          const trebleWeight = Math.pow(Math.max(0, -sinA), 1.6);
          // Side frequency bands (Mid-range & Vocals)
          const midWeight = Math.pow(Math.abs(cosA), 1.3);

          // Counter-propagating harmonic ripples around the circle at BPM tempo
          const wave1 = Math.sin(3 * angle - t * beatFreq * Math.PI * 2 * 0.5);
          const wave2 = Math.cos(5 * angle + t * beatFreq * Math.PI * 2 * 0.75);
          const wave3 = Math.sin(7 * angle - t * 3.8);

          const bassEnergy = kick * bassWeight * 22 * (0.8 + 0.4 * swell) * energyScale;
          const trebleEnergy = snare * trebleWeight * 18 * energyScale;
          const midEnergy = (0.5 + 0.5 * wave1) * midWeight * 12 * energyScale;
          const rippleEnergy = ((0.5 + 0.5 * wave2) * 5 + wave3 * 2.5) * energyScale;

          targetH = baseH + Math.max(0, bassEnergy + trebleEnergy + midEnergy + rippleEnergy);
          // Keep maximum visualizer extension comfortably within dock boundaries
          targetH = Math.min(maxH, targetH);
        }

        // Spring-physics smoothing: fast attack on peaks, smooth elastic decay
        const diff = targetH - heights[i];
        const lerpFactor = diff > 0 ? 0.42 : 0.18;
        heights[i] += diff * lerpFactor;

        const currentH = heights[i];
        const rOuter = rInner + currentH;

        const x1 = cx + rInner * cosA;
        const y1 = cy + rInner * sinA;
        const x2 = cx + rOuter * cosA;
        const y2 = cy + rOuter * sinA;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.restore();

      // Always request next frame so the loop is never halted on pause/play
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', measureDiscRadius);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [discRadius, size]);

  const isCompactCanvas = discRadius < 80;
  const canvasPx = size || (isCompactCanvas ? 180 : 340);

  return (
    <canvas
      ref={canvasRef}
      className={`circular-audio-visualizer-canvas ${isPlaying ? 'is-playing' : 'is-paused'} ${className}`}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${canvasPx}px`,
        height: `${canvasPx}px`,
        maxWidth: `${canvasPx}px`,
        maxHeight: `${canvasPx}px`,
        pointerEvents: 'none',
        zIndex: 3,
      }}
      aria-hidden="true"
    />
  );
}
