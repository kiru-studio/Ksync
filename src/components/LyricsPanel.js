import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { Volume2, Volume1, VolumeX, Sparkles, Music } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const LyricsPanel = ({
  lyrics = [],
  currentIndex = -1,
  currentTrack = null,
  isPlaying = false,
  volume = 50,
  isMuted = false,
  onVolumeChange,
  onMuteToggle,
  lyricsColor = 'white',
  provider = null,
  lyricsOffsetMs = 0,
  onOffsetChange,
  onSeek,
}) => {
  let settings = {};
  try {
    const settingsCtx = useSettings();
    if (settingsCtx && settingsCtx.settings) settings = settingsCtx.settings;
  } catch (_) {}

  const theming = settings?.theming || {};
  const lyricsFontSize = theming.lyricsFontSize ?? 20;
  const lyricsFontFamily = theming.lyricsFontFamily || 'system-ui';
  const lyricsLineHeight = theming.lyricsLineHeight ?? 1.45;
  const lyricsFontWeight = theming.lyricsFontWeight ?? 700;
  const lyricsScale = theming.lyricsScale ?? 1.04;

  const [displayVolume, setDisplayVolume] = useState(() => {
    if (typeof volume === 'number') return volume;
    try {
      const saved = localStorage.getItem('ksync_last_system_volume');
      if (saved !== null && !isNaN(Number(saved))) return Number(saved);
    } catch (_) {}
    return 50;
  });
  const [prevVolume, setPrevVolume] = useState(() => {
    if (typeof volume === 'number') return volume;
    try {
      const saved = localStorage.getItem('ksync_last_system_volume');
      if (saved !== null && !isNaN(Number(saved))) return Number(saved);
    } catch (_) {}
    return 50;
  });
  const [isMutedState, setIsMutedState] = useState(isMuted || false);
  const [isHoveringPill, setIsHoveringPill] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const trackRef = useRef(null);
  const lastSentVolRef = useRef(volume ?? 50);
  const latestTargetVolRef = useRef(volume ?? 50);
  const isInteractingRef = useRef(false);
  const throttleTimerRef = useRef(null);
  const interactionTimerRef = useRef(null);
  const lyricsRafId = useRef(null);

  const triggerInteraction = useCallback(() => {
    setIsInteracting(true);
    isInteractingRef.current = true;
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => {
      setIsInteracting(false);
      isInteractingRef.current = false;
    }, 600);
  }, []);

  // Sync external volume updates only when not actively interacting (dragging or scrolling)
  useEffect(() => {
    if (!isDraggingRef.current && !isInteractingRef.current && typeof volume === 'number') {
      setDisplayVolume(volume);
      lastSentVolRef.current = volume;
      latestTargetVolRef.current = volume;
    }
  }, [volume]);

  useEffect(() => {
    setIsMutedState(!!isMuted);
  }, [isMuted]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (lyricsRafId.current) cancelAnimationFrame(lyricsRafId.current);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
  }, []);

  const dispatchVolumeChange = useCallback((newVol, immediate = false) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVol)));
    setDisplayVolume(clamped);
    latestTargetVolRef.current = clamped;

    if (isMutedState && clamped > 0) {
      setIsMutedState(false);
      if (onMuteToggle) onMuteToggle(false);
    }

    if (immediate) {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      lastSentVolRef.current = clamped;
      if (onVolumeChange) onVolumeChange(clamped);
      return;
    }

    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        const target = latestTargetVolRef.current;
        if (lastSentVolRef.current !== target) {
          lastSentVolRef.current = target;
          if (onVolumeChange) onVolumeChange(target);
        }
      }, 40);
    }
  }, [onVolumeChange, onMuteToggle, isMutedState]);

  const calcVolumeFromEvent = useCallback((e) => {
    if (!trackRef.current) return displayVolume;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    return Math.round(percentage * 100);
  }, [displayVolume]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    const newVol = calcVolumeFromEvent(e);
    dispatchVolumeChange(newVol, true);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const newVol = calcVolumeFromEvent(e);
    setDisplayVolume(newVol);
    if (!lyricsRafId.current) {
      lyricsRafId.current = requestAnimationFrame(() => {
        lyricsRafId.current = null;
        dispatchVolumeChange(newVol, false);
      });
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (lyricsRafId.current) {
      cancelAnimationFrame(lyricsRafId.current);
      lyricsRafId.current = null;
    }
    isDraggingRef.current = false;
    setIsDragging(false);
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    isInteractingRef.current = false;
    setIsInteracting(false);
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const finalVol = calcVolumeFromEvent(e);
    dispatchVolumeChange(finalVol, true);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (isMutedState || displayVolume === 0) {
      setIsMutedState(false);
      if (onMuteToggle) onMuteToggle(false);
      const restore = prevVolume > 0 ? prevVolume : 50;
      dispatchVolumeChange(restore, true);
    } else {
      setIsMutedState(true);
      if (onMuteToggle) onMuteToggle(true);
      setPrevVolume(displayVolume);
    }
  };

  const handleWheel = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    const newVol = Math.max(0, Math.min(100, displayVolume + delta));
    dispatchVolumeChange(newVol, true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const newVol = Math.min(100, displayVolume + 5);
      dispatchVolumeChange(newVol, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const newVol = Math.max(0, displayVolume - 5);
      dispatchVolumeChange(newVol, true);
    }
  };

  const isEffectiveMuted = isMutedState || displayVolume === 0;
  const VolumeIcon = isEffectiveMuted ? VolumeX : displayVolume < 50 ? Volume1 : Volume2;

  // Prepare display lines with instrumental intro if track starts after 2s
  const { displayLines, hasIntro } = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return { displayLines: [], hasIntro: false };
    const firstStart = lyrics[0]?.startTime || 0;
    if (firstStart > 2) {
      return {
        displayLines: [
          { text: '♫ Instrumental Intro ♫', startTime: 0, isIntro: true },
          ...lyrics,
        ],
        hasIntro: true,
      };
    }
    return { displayLines: lyrics, hasIntro: false };
  }, [lyrics]);

  // Compute active index in displayLines
  const activeIndex = useMemo(() => {
    if (displayLines.length === 0) return 0;
    if (hasIntro) {
      return currentIndex < 0 ? 0 : currentIndex + 1;
    }
    return Math.max(0, currentIndex);
  }, [currentIndex, hasIntro, displayLines.length]);

  // Dynamic continuous sliding roller
  const wrapperRef = useRef(null);
  const lineRefs = useRef([]);
  const [translateY, setTranslateY] = useState(0);
  const [isTransitionReady, setIsTransitionReady] = useState(false);
  const [wrapperWidth, setWrapperWidth] = useState(500);

  // Dynamic max font size calculation to guarantee lyrics NEVER get trimmed or clipped
  const getLineFontSize = useCallback(
    (text, isActive) => {
      if (!text) return undefined;
      const base = Number(lyricsFontSize) || 20;
      const scale = Number(lyricsScale) || 1.0;
      const nominalSize = isActive ? base * scale : base * 0.88;

      // Available width inside lyrics wrapper with breathing room
      const availWidth = Math.max(160, (wrapperWidth || 500) - 32);

      // Measure character density: Unicode / Indic (Tamil, etc.) / CJK glyphs are wider (~0.85em) than Latin (~0.54em)
      let approxCharWidthEm = 0.54;
      let nonAsciiCount = 0;
      for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) > 255) nonAsciiCount++;
      }
      if (nonAsciiCount > text.length * 0.25) {
        approxCharWidthEm = 0.82;
      }

      const totalTextWidthEm = text.length * approxCharWidthEm;
      // Allow up to 2 lines cleanly centered
      const maxLines = 2.15;
      const maxAllowedWidthEm = (availWidth / nominalSize) * maxLines;

      if (totalTextWidthEm > maxAllowedWidthEm) {
        const fittedSize = Math.floor((availWidth * maxLines) / totalTextWidthEm);
        const minSize = isActive ? 13 : 11;
        return Math.max(minSize, Math.min(nominalSize, fittedSize));
      }

      return nominalSize;
    },
    [lyricsFontSize, lyricsScale, wrapperWidth]
  );

  // When track/lyrics change, jump immediately to position, then enable smooth transitions
  useEffect(() => {
    lineRefs.current = [];
    setIsTransitionReady(false);
    const timer = setTimeout(() => {
      setIsTransitionReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [lyrics]);

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current || displayLines.length === 0) return;
    const safeIndex = Math.min(Math.max(0, activeIndex), displayLines.length - 1);
    const activeEl = lineRefs.current[safeIndex];
    if (!activeEl) return;

    const wrapperHeight = wrapperRef.current.clientHeight;
    const activeTop = activeEl.offsetTop;
    const activeHeight = activeEl.offsetHeight;

    const activeCenter = activeTop + activeHeight / 2;
    const viewportCenter = wrapperHeight / 2;

    setTranslateY(viewportCenter - activeCenter);
  }, [
    activeIndex,
    displayLines.length,
    lyricsFontSize,
    lyricsFontFamily,
    lyricsLineHeight,
    lyricsFontWeight,
    lyricsScale,
    wrapperWidth,
  ]);

  useLayoutEffect(() => {
    if (wrapperRef.current) {
      const w = wrapperRef.current.clientWidth;
      if (w > 0 && Math.abs(w - wrapperWidth) > 2) {
        setWrapperWidth(w);
      }
    }
    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [updatePosition, wrapperWidth]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    let ro = null;
    try {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === wrapperRef.current) {
            const w = entry.contentRect.width;
            if (w > 0) {
              setWrapperWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
            }
          }
        }
        window.requestAnimationFrame(() => {
          updatePosition();
        });
      });
      ro.observe(wrapperRef.current);

      // Dynamically observe the active lyric element so height changes from font sizing/wrapping trigger immediate recentering
      const safeIndex = Math.min(Math.max(0, activeIndex), displayLines.length - 1);
      const activeEl = lineRefs.current[safeIndex];
      if (activeEl) {
        ro.observe(activeEl);
      }
    } catch (_) {}
    return () => ro && ro.disconnect();
  }, [updatePosition, activeIndex, displayLines.length]);

  const isExpanded = isHoveringPill || isDragging || isInteracting;

  const renderVolumeControl = () => (
    <div 
      className={`lyrics-volume-pill ${isExpanded ? 'expanded' : ''}`}
      onMouseEnter={() => setIsHoveringPill(true)}
      onMouseLeave={() => {
        setIsHoveringPill(false);
        if (!isDraggingRef.current) {
          isInteractingRef.current = false;
          setIsInteracting(false);
          if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
      }}
      onWheel={(e) => {
        handleWheel(e);
      }}
      title={`System Volume: ${displayVolume}%${isEffectiveMuted ? ' (Muted)' : ''} (Click, drag, or scroll to adjust)`}
    >
      <button
        type="button"
        className="vol-pill-btn"
        onClick={(e) => {
          triggerInteraction();
          toggleMute(e);
        }}
        title={isEffectiveMuted ? "Unmute System" : "Mute System"}
        aria-label="Toggle system mute"
        tabIndex={isExpanded ? 0 : -1}
      >
        <VolumeIcon size={14} />
      </button>

      <div
        ref={trackRef}
        className={`vol-pill-track ${isExpanded ? 'hovered' : ''} ${isDragging ? 'dragging' : ''}`}
        onPointerDown={(e) => {
          triggerInteraction();
          handlePointerDown(e);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(e) => {
          triggerInteraction();
          handleKeyDown(e);
        }}
        tabIndex={0}
        role="slider"
        aria-label="System volume slider"
        aria-valuenow={displayVolume}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div className="vol-pill-fill" style={{ width: `${displayVolume}%` }} />
        <div className="vol-pill-thumb" style={{ left: `${displayVolume}%` }} />
      </div>

      <span className="vol-pill-label">
        {displayVolume}%
      </span>
    </div>
  );

  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="lyrics-panel-compact ambient-instrumental-panel">
        {renderVolumeControl()}

        {/* Ambient Stage Backdrop Glow */}
        <div className="ambient-stage-glow" />

        <div className="ambient-stage-container">
          {/* Instrumental / Pure Audio Pill Badge */}
          <div className="ambient-badge-pill">
            <Sparkles size={11} className="ambient-badge-icon" />
            <span>{currentTrack?.title ? 'Synced Lyrics Unavailable • Pure Audio' : 'Waiting for track...'}</span>
          </div>

          {/* Large Stylized Artist & Track Backdrop Typography */}
          <div className="ambient-meta-cluster">
            <h2 className="ambient-track-title">{currentTrack?.title || 'ksync Audio Stage'}</h2>
            <div className="ambient-artist-name">{currentTrack?.artist || 'Ready for Spotify playback'}</div>
          </div>

          {/* Dynamic Ambient Sound Waveform (Mirrored Equalizer) */}
          <div className={`ambient-wave-cluster ${isPlaying ? 'is-playing' : 'is-paused'}`}>
            {[18, 28, 45, 65, 85, 55, 38, 72, 95, 80, 60, 40, 60, 80, 95, 72, 38, 55, 85, 65, 45, 28, 18].map((h, i) => (
              <span
                key={i}
                className="ambient-eq-bar"
                style={{
                  '--base-h': `${h}%`,
                  '--wave-delay': `${(i % 6) * -0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lyrics-panel-compact">
      {/* Spotify Dedicated Volume Control Pill in Center Panel Header */}
      {renderVolumeControl()}

      {/* Continuously Sliding 3-Line Lyrics Stream with Dynamic Vertical Centering */}
      <div className="lyrics-lines-wrapper" ref={wrapperRef}>
        <div
          className="lyrics-roller"
          style={{
            transform: `translate3d(0, ${translateY}px, 0)`,
            transition: isTransitionReady
              ? 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
          }}
        >
          {displayLines.map((line, idx) => {
            const isCur = idx === activeIndex;
            const isPrev = idx === activeIndex - 1;
            const isNext = idx === activeIndex + 1;

            let lineStateClass = 'lyric-hidden';
            if (isCur) lineStateClass = 'lyric-active';
            else if (isPrev) lineStateClass = 'lyric-prev';
            else if (isNext) lineStateClass = 'lyric-next';

            const isClickable = typeof line.startTime === 'number' && !line.isIntro && !!onSeek;
            const computedSize = line.text ? getLineFontSize(line.text, isCur) : undefined;

            return (
              <div
                key={`${line.startTime ?? idx}-${idx}`}
                ref={(el) => (lineRefs.current[idx] = el)}
                className={`lyric-line ${lineStateClass} ${line.isIntro ? 'intro' : ''} ${isClickable ? 'is-seekable' : ''}`}
                style={{
                  fontSize: computedSize ? `${computedSize}px` : undefined,
                }}
                onClick={() => {
                  if (isClickable) {
                    onSeek(line.startTime);
                  }
                }}
                title={
                  isClickable
                    ? `Jump to ${Math.floor(line.startTime / 60)}:${String(Math.floor(line.startTime % 60)).padStart(2, '0')}`
                    : line.text
                }
              >
                {line.isIntro ? (
                  <div className="lyric-music-wave-badge" title="Musical Interlude">
                    <Music size={14} className="music-note-glyph" />
                    <div className="music-wave-bars">
                      <span className="music-note-bar b-1" />
                      <span className="music-note-bar b-2" />
                      <span className="music-note-bar b-3" />
                      <span className="music-note-bar b-4" />
                      <span className="music-note-bar b-5" />
                    </div>
                  </div>
                ) : (
                  <span className="lyric-text-content">{line.text}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LyricsPanel;
