import React, { useState, useEffect, useRef, useCallback } from 'react';
import NowPlaying from './components/NowPlaying';
import LyricsPanel from './components/LyricsPanel';
import QueuePanel from './components/QueuePanel';
import SidebarDock from './components/SidebarDock';
import LoginScreen from './components/LoginScreen';
import UserProfile from './components/UserProfile';
import SpotifyService from './services/SpotifyService';
import { extractVibrantColor, hexToRgb } from './utils/colorExtractor';
import { Play, Pause, Maximize2 } from 'lucide-react';
import MarqueeText from './components/MarqueeText';
import SquareDynamicIsland from './components/SquareDynamicIsland';
import ErrorBoundary from './components/ErrorBoundary';
import { useSettings } from './context/SettingsContext';

function App() {
  const { settings, setDockHeight, setSidebarWidth, updateSettings } = useSettings();
  const [isVisible, setIsVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dockDimensions, setDockDimensions] = useState(() => {
    const initialH = typeof window !== 'undefined' && window.innerHeight > 150
      ? window.innerHeight
      : (typeof window !== 'undefined' ? Math.min(Math.max(Math.round(window.screen.height * 0.172), 185), 280) : 190);
    return { width: (typeof window !== 'undefined' && window.innerWidth) || 1920, height: initialH, mode: 'top' };
  });
  const [authError, setAuthError] = useState(null);
  const [user, setUser] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Dynamic Volume State: seamlessly restores last known volume, preventing 50% flash
  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('ksync_last_volume');
      if (saved !== null && !isNaN(Number(saved))) return Number(saved);
    } catch (_) {}
    return typeof settings?.audio?.lastSpotifyVolume === 'number' ? settings.audio.lastSpotifyVolume : 50;
  });

  const [systemVolume, setSystemVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('ksync_last_system_volume');
      if (saved !== null && !isNaN(Number(saved))) return Number(saved);
    } catch (_) {}
    return typeof settings?.audio?.lastSystemVolume === 'number' ? settings.audio.lastSystemVolume : 50;
  });

  const [systemMuted, setSystemMuted] = useState(() => {
    try {
      const saved = localStorage.getItem('ksync_last_system_muted');
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return !!settings?.audio?.lastSystemMuted;
  });

  const updateSystemVolumeState = useCallback((vol, isMuted) => {
    if (typeof vol === 'number') {
      setSystemVolume(vol);
      try { localStorage.setItem('ksync_last_system_volume', String(vol)); } catch (_) {}
    }
    if (typeof isMuted === 'boolean') {
      setSystemMuted(isMuted);
      try { localStorage.setItem('ksync_last_system_muted', String(isMuted)); } catch (_) {}
    }
  }, []);

  const updateSpotifyVolumeState = useCallback((vol) => {
    if (typeof vol === 'number') {
      setVolume(vol);
      try { localStorage.setItem('ksync_last_volume', String(vol)); } catch (_) {}
    }
  }, []);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isDeepSleep, setIsDeepSleep] = useState(false);
  const isDeepSleepRef = useRef(false);
  const isDockHoveredRef = useRef(false);

  // Sync deep sleep CSS class to body
  useEffect(() => {
    isDeepSleepRef.current = isDeepSleep;
    if (isDeepSleep) {
      document.body.classList.add('zero-wake-deep-sleep');
    } else {
      document.body.classList.remove('zero-wake-deep-sleep');
    }
  }, [isDeepSleep]);

  const wakeUpFromDeepSleep = () => {
    if (isDeepSleepRef.current) {
      setIsDeepSleep(false);
      if (window.electronAPI && window.electronAPI.wakeFromDeepSleep) {
        window.electronAPI.wakeFromDeepSleep();
      }
      updatePlayerState();
    }
  };

  // Listen for IPC deep sleep events from Electron
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onDeepSleepMode) {
      window.electronAPI.onDeepSleepMode(({ isSleeping }) => {
        setIsDeepSleep(!!isSleeping);
      });
    }
  }, []);

  // 3-Minute Idle Timer when playback is paused
  useEffect(() => {
    if (isPlaying) {
      if (isDeepSleepRef.current) wakeUpFromDeepSleep();
      return;
    }
    const timer = setTimeout(() => {
      setIsDeepSleep(true);
    }, 3 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  // Wake on user interaction
  useEffect(() => {
    const handleActivity = () => {
      if (isDeepSleepRef.current) {
        wakeUpFromDeepSleep();
      }
    };
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  // Dock Quick Hotkeys: Space, Arrows, M
  useEffect(() => {
    const handleDockQuickHotkeys = (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (
        e.target &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable)
      ) {
        return;
      }

      // Check if dock is hovered or focused
      const isFocusedOrHovered =
        isDockHoveredRef.current ||
        (typeof document !== 'undefined' && document.hasFocus && document.hasFocus());

      if (!isFocusedOrHovered) return;

      // Space: Play / Pause
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      // Left Arrow: Seek -5s
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const targetSeek = Math.max(0, (progress || 0) - 5);
        handleProgressChange(targetSeek);
        return;
      }

      // Right Arrow: Seek +5s
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const targetSeek = Math.min(duration || 0, (progress || 0) + 5);
        handleProgressChange(targetSeek);
        return;
      }

      // Up Arrow: Volume +5%
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const curVol = typeof systemVolume === 'number' ? systemVolume : (volume || 50);
        const nextVol = Math.min(100, curVol + 5);
        handleSystemVolumeChange(nextVol);
        handleVolumeChange(nextVol);
        return;
      }

      // Down Arrow: Volume -5%
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const curVol = typeof systemVolume === 'number' ? systemVolume : (volume || 50);
        const nextVol = Math.max(0, curVol - 5);
        handleSystemVolumeChange(nextVol);
        handleVolumeChange(nextVol);
        return;
      }

      // M / m: Mute / Unmute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleSystemMuteToggle(!systemMuted);
        return;
      }
    };

    window.addEventListener('keydown', handleDockQuickHotkeys);
    return () => window.removeEventListener('keydown', handleDockQuickHotkeys);
  }, [isPlaying, progress, duration, systemVolume, volume, systemMuted]);

  // Listen for compact Dynamic Island mode toggle (Ctrl+Shift+M)
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onCompactModeChanged) {
      window.electronAPI.onCompactModeChanged(({ isCompact }) => {
        setIsCompactMode(!!isCompact);
      });
    }
  }, []);

  // Broadcast live Spotify playback to Discord Rich Presence (RPC)
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.updateDiscordRPC) {
      if (currentTrack && currentTrack.title) {
        window.electronAPI.updateDiscordRPC({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          albumArt: currentTrack.albumArt,
          durationMs: currentTrack.duration_ms || currentTrack.durationMs || (duration ? duration * 1000 : 0),
          positionMs: Math.round(progress * 1000),
          isPlaying: !!isPlaying,
          trackId: currentTrack.id,
        });
      } else {
        window.electronAPI.updateDiscordRPC(null);
      }
    }
  }, [currentTrack?.title, currentTrack?.artist, currentTrack?.albumArt, isPlaying, Math.round(progress / 4)]);
  const [queue, setQueue] = useState([]);
  const [devices, setDevices] = useState([]);
  const [shuffleState, setShuffleState] = useState(false);
  const [repeatState, setRepeatState] = useState('off');
  const [lyrics, setLyrics] = useState([]);
  const [lyricsProvider, setLyricsProvider] = useState(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);
  const [playbackBackend, setPlaybackBackend] = useState('smtc');

  const tickRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const baseProgressSecRef = useRef(0);
  const baseTimestampMsRef = useRef(Date.now());
  const isPlayingRef = useRef(false);
  const lastValidTrackRef = useRef(null);
  const nullResponseTimeRef = useRef(null);
  const NULL_GRACE_PERIOD_MS = 10000;
  const playerPollIntervalRef = useRef(null);
  const queuePollIntervalRef = useRef(null);
  const devicesPollIntervalRef = useRef(null);
  const lastQueueFetchRef = useRef(0);
  const lastDevicesFetchRef = useRef(0);

  // Resize & Interactive Splitter state
  const dockContainerRef = useRef(null);
  const isDraggingResizeRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartXRef = useRef(0);
  const resizeStartHRef = useRef(190);
  const resizeStartWRef = useRef(340);

  const isDraggingDividerRef = useRef(false);
  const activeDividerIdxRef = useRef(null);
  const dividerStartCoordRef = useRef(0);
  const dividerStartRatiosRef = useRef([]);
  const [activeDividerIdx, setActiveDividerIdx] = useState(null);
  const [liveRatios, setLiveRatios] = useState(null);

  const handleLogin = async () => {
    try {
      setAuthError(null);
      await SpotifyService.authenticate();
      setIsAuthenticated(true);
      const profile = await SpotifyService.getCurrentUser();
      setUser(profile || null);
      updatePlayerState();
      updateQueue(true);
    } catch (error) {
      setAuthError(error.message || 'Login failed. Check your Spotify Client ID in config.');
      console.error('Login error:', error);
    }
  };

  // Sample vibrant accent color from current album artwork & sync dynamic lyrics
  useEffect(() => {
    const isArtworkReactive =
      (settings.theming?.backdropStyle === 'artwork' ||
      settings.theming?.preset === 'artwork') &&
      settings.theming?.artworkSampling !== false;

    const isDynamicLyrics =
      settings.theming?.lyricsActiveColor === 'dynamic' ||
      (!settings.theming?.lyricsActiveColor && isArtworkReactive);

    if (isArtworkReactive && currentTrack?.albumArt) {
      extractVibrantColor(currentTrack.albumArt, settings.theming?.accentColor || '#38bdf8').then((accent) => {
        if (accent) {
          document.documentElement.style.setProperty('--accent', accent.hex);
          document.documentElement.style.setProperty('--accent-rgb', accent.rgb);
          document.documentElement.style.setProperty('--accent-soft', accent.soft);
          document.documentElement.style.setProperty('--accent-glow', accent.glow);
          if (isDynamicLyrics) {
            document.documentElement.style.setProperty('--dock-lyrics-active', accent.hex);
            document.documentElement.style.setProperty('--dock-lyrics-active-glow', accent.glow);
          } else {
            const fixedLyrics = settings.theming?.lyricsActiveColor || '#1db954';
            document.documentElement.style.setProperty('--dock-lyrics-active', fixedLyrics);
            document.documentElement.style.setProperty('--dock-lyrics-active-glow', settings.theming?.lyricsGlowColor || fixedLyrics);
          }
          document.documentElement.style.setProperty('--progress-color', accent.hex);
        }
      });
    } else {
      if (settings.theming?.accentColor) {
        document.documentElement.style.setProperty('--accent', settings.theming.accentColor);
        document.documentElement.style.setProperty('--accent-rgb', hexToRgb(settings.theming.accentColor));
        document.documentElement.style.setProperty('--accent-soft', `${settings.theming.accentColor}26`);
        document.documentElement.style.setProperty('--accent-glow', `${settings.theming.accentColor}59`);
      }
      const lyricsColor = isDynamicLyrics
        ? 'var(--accent)'
        : (settings.theming?.lyricsActiveColor || '#1db954');
      const glowColor = settings.theming?.lyricsGlowColor || lyricsColor;
      document.documentElement.style.setProperty('--dock-lyrics-active', lyricsColor);
      document.documentElement.style.setProperty('--dock-lyrics-active-glow', glowColor);
      if (settings.theming?.progressColor) {
        document.documentElement.style.setProperty('--progress-color', settings.theming.progressColor);
      }
    }
  }, [
    currentTrack?.albumArt,
    settings.theming?.backdropStyle,
    settings.theming?.preset,
    settings.theming?.artworkSampling,
    settings.theming?.accentColor,
    settings.theming?.lyricsActiveColor,
    settings.theming?.lyricsGlowColor,
    settings.theming?.progressColor,
  ]);

  useEffect(() => {
    document.title = 'ksync';
    // Listen for dock visibility changes from Electron
    if (window.electronAPI) {
      window.electronAPI.onDockVisibilityChange((visible) => {
        setIsVisible(visible);
      });
      if (window.electronAPI.getDockVisibility) {
        window.electronAPI.getDockVisibility().then((visible) => {
          setIsVisible(visible);
        });
      }

      if (window.electronAPI.isSettingsOpen) {
        window.electronAPI.isSettingsOpen().then((open) => {
          setIsSettingsOpen(!!open);
        });
      }

      if (window.electronAPI.onSettingsWindowState) {
        window.electronAPI.onSettingsWindowState((state) => {
          setIsSettingsOpen(!!state?.isOpen);
        });
      }

      if (window.electronAPI.getPlaybackBackend) {
        window.electronAPI.getPlaybackBackend().then((b) => setPlaybackBackend(b || 'smtc'));
      }
      
      // Listen for dock dimensions from Electron
      window.electronAPI.onDockDimensions((dimensions) => {
        if (dimensions && dimensions.height) {
          setDockDimensions(dimensions);
          document.documentElement.style.setProperty('--dock-height', `${dimensions.height}px`);
        }
      });
    }

    SpotifyService.init();

    // Query and subscribe to dynamic Windows Master System Volume
    if (window.electronAPI && window.electronAPI.getSystemVolume) {
      window.electronAPI.getSystemVolume().then((res) => {
        if (res && typeof res.volume === 'number') {
          updateSystemVolumeState(res.volume, res.isMuted);
        }
      }).catch(() => {});
    }

    if (window.electronAPI && window.electronAPI.onSystemVolumeChanged) {
      window.electronAPI.onSystemVolumeChanged((data) => {
        if (data && typeof data.volume === 'number') {
          updateSystemVolumeState(data.volume, data.isMuted);
        }
      });
    }

    // Query and subscribe to dynamic Spotify process volume
    if (window.electronAPI && window.electronAPI.getSpotifyVolume) {
      window.electronAPI.getSpotifyVolume().then((res) => {
        if (res && typeof res.volume === 'number') {
          updateSpotifyVolumeState(res.volume);
        }
      }).catch(() => {});
    }

    if (window.electronAPI && window.electronAPI.onSpotifyVolumeChanged) {
      window.electronAPI.onSpotifyVolumeChanged((data) => {
        if (data && typeof data.volume === 'number') {
          updateSpotifyVolumeState(data.volume);
        }
      });
    }

    const checkAuth = async () => {
      try {
        const hasTokens = window.electronAPI ? await window.electronAPI.spotifyHasTokens() : false;
        setIsAuthenticated(!!hasTokens);
        if (hasTokens) {
          const profile = await SpotifyService.getCurrentUser();
          setUser(profile || null);
          updateSpotifyData();
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthError('Failed to verify authentication');
      }
    };
    checkAuth();

    // Immediate push updates for SMTC
    SpotifyService.onStateChange(() => {
      updatePlayerState();
    });

    const updateSpotifyData = (force = false) => {
      updatePlayerState();
      updateQueue(force);
      updateDevices();
    };

    try {
      SpotifyService.onLoginDone(async () => {
        setIsAuthenticated(true);
        const profile = await SpotifyService.getCurrentUser();
        setUser(profile || null);
        updateSpotifyData(true);
      });
      SpotifyService.onLogoutDone(() => {
        setIsAuthenticated(false);
        setUser(null);
      });
    } catch (_) {}

    // Event listeners for mouse enter/leave
    const handleMouseEnter = () => {
      isDockHoveredRef.current = true;
      if (window.electronAPI) {
        window.electronAPI.onMouseEnter();
      }
    };

    const handleMouseLeave = () => {
      isDockHoveredRef.current = false;
      if (window.electronAPI) {
        window.electronAPI.onMouseLeave();
      }
    };

    const handleWheel = (e) => {
      // Do not auto-hide the dock if user is scrolling queue, lyrics or settings
      if (
        e.target &&
        e.target.closest &&
        (e.target.closest('.queue-panel-compact') ||
          e.target.closest('.lyrics-panel-compact') ||
          e.target.closest('.settings-drawer'))
      ) {
        return;
      }

      // Mouse wheel volume adjustment
      if (settings.behavior?.mouseWheelVolume !== false) {
        const step = e.deltaY < 0 ? 3 : -3;
        setVolume((prev) => {
          const nextVol = Math.min(Math.max(prev + step, 0), 100);
          handleVolumeChange(nextVol);
          return nextVol;
        });
      }

      if (e.deltaY > 20 && window.electronAPI && window.electronAPI.scrollHide && !settings.position?.pinned) {
        window.electronAPI.scrollHide();
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('wheel', handleWheel, { passive: true });

    // Adaptive polling strategy
    const startPolling = () => {
      const pollPlayer = () => {
        updatePlayerState();
        const nextInterval = isPlayingRef.current ? 1500 : 3000;
        playerPollIntervalRef.current = setTimeout(pollPlayer, nextInterval);
      };
      pollPlayer();

      const pollQueue = () => {
        updateQueue();
        queuePollIntervalRef.current = setTimeout(pollQueue, 10000);
      };
      setTimeout(pollQueue, 2000);

      const pollDevices = () => {
        updateDevices();
        devicesPollIntervalRef.current = setTimeout(pollDevices, 15000);
      };
      setTimeout(pollDevices, 3000);
    };

    startPolling();

    const handleOnline = () => {
      setApiError(null);
      updatePlayerState();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      if (playerPollIntervalRef.current) clearTimeout(playerPollIntervalRef.current);
      if (queuePollIntervalRef.current) clearTimeout(queuePollIntervalRef.current);
      if (devicesPollIntervalRef.current) clearTimeout(devicesPollIntervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [settings.behavior?.mouseWheelVolume, settings.position?.pinned]);

  // Player state updater
  const updatePlayerState = async () => {
    let trackData = null;
    const maxRetries = 3;
    const backoffMs = [2000, 4000, 8000];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        trackData = await SpotifyService.getCurrentTrack();
        setApiError(null);
        break;
      } catch (err) {
        if (err.message === 'Not authenticated') {
          setIsAuthenticated(false);
          setApiError(null);
          return;
        }
        if (attempt === maxRetries) {
          console.error('[App] Failed to get track after retries:', err.message);
          setApiError(err.message || 'Connection error');
        } else {
          await new Promise((r) => setTimeout(r, backoffMs[attempt]));
        }
      }
    }
    
    const isValidTrack = trackData && trackData.title && trackData.type !== 'noSession';

    if (isValidTrack) {
      setAuthError(null);
      setCurrentTrack(trackData);
      lastValidTrackRef.current = trackData;
      nullResponseTimeRef.current = null;
      setIsPlaying(!!trackData.isPlaying);
      isPlayingRef.current = !!trackData.isPlaying;

      let durationSec = trackData.durationMs != null ? trackData.durationMs / 1000 : (trackData.duration || 0);
      let progressSec = trackData.progressMs != null ? trackData.progressMs / 1000 : (trackData.progress || 0);
      if (trackData.serverTimestamp && trackData.isPlaying) {
        const serverTs = typeof trackData.serverTimestamp === 'number' ? trackData.serverTimestamp : new Date(trackData.serverTimestamp).getTime();
        if (!Number.isNaN(serverTs)) {
          progressSec += Math.max(0, (Date.now() - serverTs) / 1000);
        }
      }
      if (durationSec > 0) progressSec = Math.max(0, Math.min(progressSec, durationSec));
      baseProgressSecRef.current = progressSec;
      baseTimestampMsRef.current = Date.now();
      setProgress(progressSec);
      setDuration(durationSec);
      if (typeof trackData.volume === 'number') updateSpotifyVolumeState(trackData.volume);
      if (typeof trackData.shuffleState === 'boolean') setShuffleState(trackData.shuffleState);
      if (trackData.repeatState) setRepeatState(trackData.repeatState);
    } else {
      const now = Date.now();
      if (nullResponseTimeRef.current === null) {
        nullResponseTimeRef.current = now;
      }
      const timeSinceNull = now - nullResponseTimeRef.current;
      
      if (lastValidTrackRef.current && timeSinceNull < NULL_GRACE_PERIOD_MS) {
        return;
      }
      
      if (!lastValidTrackRef.current || timeSinceNull >= NULL_GRACE_PERIOD_MS) {
        setCurrentTrack(null);
        setIsPlaying(false);
        isPlayingRef.current = false;
        setProgress(0);
        setDuration(0);
      }
    }

    // Smooth lyrics logic
    const newTrackId = trackData?.id || trackData?.trackId || trackData?.track?.id || (trackData?.title ? `${trackData.title}-${trackData.artist}` : null);
    if (newTrackId && newTrackId !== lastTrackIdRef.current) {
      const isFirstLoad = lastTrackIdRef.current === null;
      lastTrackIdRef.current = newTrackId;
      setLyrics([]);
      setLyricsProvider(null);
      setCurrentLyricIndex(0);
      setLyricsOffsetMs(0);

      // Trigger Dynamic Island "Peek-on-Track-Change" when dock is auto-hidden
      if (!isFirstLoad && window.electronAPI && window.electronAPI.triggerTrackPeek && trackData?.title) {
        window.electronAPI.triggerTrackPeek({
          title: trackData.title,
          artist: trackData.artist,
          album: trackData.album,
          albumArt: trackData.albumArt,
          isPlaying: !!trackData.isPlaying,
          durationMs: trackData.durationMs,
        });
      }

      SpotifyService.getLyrics(newTrackId, trackData).then((res) => {
        if (res && res.lines && res.lines.length) {
          setLyrics(res.lines);
          setLyricsProvider(res.provider);
          updateCurrentLyric(baseProgressSecRef.current || 0, res.lines);
        }
      }).catch((err) => {
        console.error('[App] Lyrics fetch error:', err);
      });
    }
  };

  const updateQueue = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastQueueFetchRef.current < 5000) return;
    lastQueueFetchRef.current = now;

    try {
      const activeTrack = lastValidTrackRef.current || currentTrack;
      const queueData = await SpotifyService.getQueue(activeTrack);
      if (queueData && queueData.items && queueData.items.length) {
        const raw = queueData.items;
        const seen = new Set();
        const unique = raw.filter((t) => {
          const id = t.id || t.uri;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const limitedQueue = { ...queueData, items: unique.slice(0, 30) };
        setQueue(limitedQueue);
      }
    } catch (_) {}
  };

  const updateDevices = async () => {
    const now = Date.now();
    if (now - lastDevicesFetchRef.current < 12000) return;
    lastDevicesFetchRef.current = now;

    try {
      const deviceList = await SpotifyService.getDevices();
      if (deviceList && deviceList.length) setDevices(deviceList);
    } catch (_) {}
  };

  const updateCurrentLyric = (currentTime, lyricsArray) => {
    if (!lyricsArray || lyricsArray.length === 0) return;

    const offsetSec = Math.abs(lyricsOffsetMs) > 100 ? lyricsOffsetMs / 1000 : lyricsOffsetMs;
    const t = Math.max(0, currentTime + offsetSec);

    let idx = -1;
    for (let i = 0; i < lyricsArray.length; i++) {
      if (t >= lyricsArray[i].startTime) {
        idx = i;
      } else {
        break;
      }
    }

    setCurrentLyricIndex((prev) => (prev !== idx ? idx : prev));
  };

  // Smooth ticking
  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (isPlaying) {
      tickRef.current = setInterval(() => {
        const elapsedSec = (Date.now() - baseTimestampMsRef.current) / 1000;
        const computed = Math.min((baseProgressSecRef.current || 0) + elapsedSec, duration || 0);
        setProgress(computed);
        if (lyrics && lyrics.length) {
          updateCurrentLyric(computed, lyrics);
        }
      }, 100);
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isPlaying, duration, lyrics]);

  // Controls
  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await SpotifyService.pause();
      } else {
        await SpotifyService.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  const handleSkip = async (direction) => {
    try {
      if (direction === 'next') {
        await SpotifyService.skipNext();
      } else {
        await SpotifyService.skipPrevious();
      }
    } catch (error) {
      console.error('Error skipping track:', error);
    }
  };

  const handleVolumeChange = async (newVolume) => {
    updateSpotifyVolumeState(newVolume);
    try {
      await SpotifyService.setVolume(newVolume);
    } catch (error) {
      console.error('Error changing volume:', error);
    }
  };

  const handleSystemVolumeChange = async (newVolume) => {
    updateSystemVolumeState(newVolume);
    if (window.electronAPI && window.electronAPI.setSystemVolume) {
      try {
        await window.electronAPI.setSystemVolume(newVolume);
      } catch (error) {
        console.error('Error changing system volume:', error);
      }
    }
  };

  const handleSystemMuteToggle = async (muted) => {
    updateSystemVolumeState(undefined, muted);
    if (window.electronAPI && window.electronAPI.setSystemMute) {
      try {
        await window.electronAPI.setSystemMute(muted);
      } catch (error) {
        console.error('Error toggling system mute:', error);
      }
    }
  };

  const handleProgressChange = async (newProgress) => {
    try {
      await SpotifyService.seek(newProgress);
      setProgress(newProgress);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const handleLogout = () => {
    SpotifyService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleShuffle = async (state) => {
    try {
      await SpotifyService.setShuffle(state);
      setShuffleState(state);
    } catch (err) {
      console.error('Error setting shuffle:', err);
    }
  };

  const handleRepeat = async (state) => {
    try {
      await SpotifyService.setRepeat(state);
      setRepeatState(state);
    } catch (err) {
      console.error('Error setting repeat:', err);
    }
  };

  const handleDeviceChange = async (deviceId) => {
    try {
      if (deviceId) {
        await SpotifyService.transferPlayback([deviceId], isPlaying);
        await updateDevices();
        await updatePlayerState();
      }
    } catch (err) {
      console.error('Error switching device:', err);
    }
  };

  const handlePlayQueueTrack = async (uri, queueOffset, track, queueContextUri = null) => {
    let webApiSuccess = false;
    const activeContext = queueContextUri || queue?.contextUri || currentTrack?.contextUri || null;
    try {
      const hasTokens = window.electronAPI ? await window.electronAPI.spotifyHasTokens() : false;
      if (hasTokens && uri) {
        // Pass uri and active context so playlist playback continues seamlessly!
        const res = await SpotifyService.playTrack({ uri, contextUri: activeContext });
        if (res && res.ok) {
          webApiSuccess = true;
          return;
        }
      }
    } catch (err) {
      console.warn('[App] Web API playTrack failed:', err);
    }

    if (!webApiSuccess) {
      if (queueOffset === 0) {
        if (window.electronAPI && window.electronAPI.smtcSeek) {
          await window.electronAPI.smtcSeek(0);
        }
        await SpotifyService.play();
      } else if (typeof queueOffset === 'number' && queueOffset > 0) {
        if (window.electronAPI && window.electronAPI.smtcSkipN) {
          await window.electronAPI.smtcSkipN(queueOffset);
        } else {
          for (let i = 0; i < queueOffset; i++) {
            await SpotifyService.skipNext();
            if (i < queueOffset - 1) await new Promise((r) => setTimeout(r, 280));
          }
        }
        setTimeout(() => SpotifyService.play(), 200);
      } else if (typeof queueOffset === 'number' && queueOffset < 0) {
        const absOffset = Math.abs(queueOffset);
        if (window.electronAPI && window.electronAPI.smtcSkipPrevN) {
          await window.electronAPI.smtcSkipPrevN(absOffset);
        } else {
          for (let i = 0; i < absOffset; i++) {
            await SpotifyService.skipPrevious();
            if (i < absOffset - 1) await new Promise((r) => setTimeout(r, 280));
          }
        }
        setTimeout(() => SpotifyService.play(), 200);
      } else {
        await SpotifyService.play();
      }
    }
  };

  // Interactive bottom-edge drag resize handle (Top Mode) - Only available when Settings is open
  const handleResizeMouseDown = (e) => {
    if (!isSettingsOpen) return;
    const currentMode = settings.position?.mode || 'top';
    if (currentMode === 'left' || currentMode === 'right') return;
    isDraggingResizeRef.current = true;
    resizeStartYRef.current = e.clientY;
    resizeStartHRef.current = dockDimensions.height || settings.position?.height || 190;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    let latestHeight = resizeStartHRef.current;

    const handleMouseMove = (ev) => {
      if (!isDraggingResizeRef.current) return;
      const delta = ev.clientY - resizeStartYRef.current;
      const newHeight = Math.min(Math.max(Math.round(resizeStartHRef.current + delta), 140), 320);
      latestHeight = newHeight;
      setDockDimensions((prev) => ({ ...prev, height: newHeight }));
      if (window.electronAPI?.setDockHeight) {
        window.electronAPI.setDockHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isDraggingResizeRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (setDockHeight) {
        setDockHeight(latestHeight);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeDoubleClick = () => {
    if (!isSettingsOpen) return;
    const defaultH = 190;
    setDockDimensions((prev) => ({ ...prev, height: defaultH }));
    if (window.electronAPI?.setDockHeight) {
      window.electronAPI.setDockHeight(defaultH);
    }
    if (setDockHeight) {
      setDockHeight(defaultH);
    }
  };

  // Interactive sidebar edge drag resize handle (Sidebar Mode)
  const handleSidebarResizeMouseDown = (e, side) => {
    if (!isSettingsOpen) return;
    isDraggingResizeRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWRef.current = dockDimensions.width || settings.position?.sidebarWidth || 340;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    let latestWidth = resizeStartWRef.current;

    const handleMouseMove = (ev) => {
      if (!isDraggingResizeRef.current) return;
      const delta = side === 'left'
        ? (ev.clientX - resizeStartXRef.current)
        : (resizeStartXRef.current - ev.clientX);
      const newWidth = Math.min(Math.max(Math.round(resizeStartWRef.current + delta), 260), 520);
      latestWidth = newWidth;
      setDockDimensions((prev) => ({ ...prev, width: newWidth }));
      if (window.electronAPI?.setSidebarWidth) {
        window.electronAPI.setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDraggingResizeRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (setSidebarWidth) {
        setSidebarWidth(latestWidth);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSidebarResizeDoubleClick = () => {
    if (!isSettingsOpen) return;
    const defaultW = 340;
    setDockDimensions((prev) => ({ ...prev, width: defaultW }));
    if (window.electronAPI?.setSidebarWidth) {
      window.electronAPI.setSidebarWidth(defaultW);
    }
    if (setSidebarWidth) {
      setSidebarWidth(defaultW);
    }
  };

  // Layout modular panel filtering & ordering
  const mode = settings.position?.mode || dockDimensions.mode || 'top';
  const isIsland = settings.position?.style === 'island';
  const panelOrder = settings.layout?.panelOrder || ['nowPlaying', 'lyrics', 'queue'];
  
  const activePanels = panelOrder.filter((id) => {
    if (id === 'nowPlaying') return settings.layout?.showNowPlaying !== false;
    if (id === 'lyrics') return settings.layout?.showLyrics !== false;
    if (id === 'queue') return settings.layout?.showQueue !== false;
    return true;
  });

  const isSolo = activePanels.length === 1;
  const soloClass = isSolo ? 'solo-expanded' : '';
  const isTwoPanelBalanced = activePanels.length === 2;

  // Determine section sizing ratios
  // Defaults: 1:2:1 on top ([25, 50, 25]), 2:1:2 on sidebar ([40, 20, 40])
  const defaultRatios = mode === 'top'
    ? (activePanels.length === 3 ? [25, 50, 25] : (activePanels.length === 2 ? [50, 50] : [100]))
    : (activePanels.length === 3 ? [40, 20, 40] : (activePanels.length === 2 ? [50, 50] : [100]));

  const configuredRatios = mode === 'top'
    ? (activePanels.length === 3 ? settings.layout?.sectionRatios : settings.layout?.twoPanelRatios)
    : (activePanels.length === 3 ? settings.layout?.sidebarSectionRatios : settings.layout?.twoPanelSidebarRatios);

  const effectiveRatios = (liveRatios && liveRatios.length === activePanels.length)
    ? liveRatios
    : (Array.isArray(configuredRatios) && configuredRatios.length === activePanels.length
        ? configuredRatios
        : defaultRatios);

  // Interactive Panel Divider Drag (Section Ratio Adjuster) - Only available when Settings is open
  const handleDividerMouseDown = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSettingsOpen) return;

    const isTop = mode === 'top';
    const container = dockContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerSize = isTop ? rect.width : rect.height;
    if (!containerSize || containerSize <= 0) return;

    isDraggingDividerRef.current = true;
    activeDividerIdxRef.current = index;
    setActiveDividerIdx(index);
    dividerStartCoordRef.current = isTop ? e.clientX : e.clientY;

    const curRatios = [...effectiveRatios];
    dividerStartRatiosRef.current = curRatios;

    document.body.style.cursor = isTop ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    let latestRatios = curRatios;

    const handleMouseMove = (ev) => {
      if (!isDraggingDividerRef.current) return;
      const currentCoord = isTop ? ev.clientX : ev.clientY;
      const deltaPx = currentCoord - dividerStartCoordRef.current;
      const deltaPct = (deltaPx / containerSize) * 100;

      const idxA = activeDividerIdxRef.current;
      const idxB = idxA + 1;
      const baseA = dividerStartRatiosRef.current[idxA];
      const baseB = dividerStartRatiosRef.current[idxB];
      const combined = baseA + baseB;

      // Minimum constraint so neither section collapses completely (12%)
      const minRatio = 12;
      const newA = Math.min(Math.max(baseA + deltaPct, minRatio), combined - minRatio);
      const newB = combined - newA;

      const updated = [...dividerStartRatiosRef.current];
      updated[idxA] = Math.round(newA * 10) / 10;
      updated[idxB] = Math.round(newB * 10) / 10;

      latestRatios = updated;
      setLiveRatios(updated);
    };

    const handleMouseUp = () => {
      isDraggingDividerRef.current = false;
      activeDividerIdxRef.current = null;
      setActiveDividerIdx(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (latestRatios) {
        if (isTop) {
          if (activePanels.length === 3) {
            updateSettings({ layout: { sectionRatios: latestRatios } });
          } else if (activePanels.length === 2) {
            updateSettings({ layout: { twoPanelRatios: latestRatios } });
          }
        } else {
          if (activePanels.length === 3) {
            updateSettings({ layout: { sidebarSectionRatios: latestRatios } });
          } else if (activePanels.length === 2) {
            updateSettings({ layout: { twoPanelSidebarRatios: latestRatios } });
          }
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDividerDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSettingsOpen) return;
    const isTop = mode === 'top';
    const def = isTop
      ? (activePanels.length === 3 ? [25, 50, 25] : [50, 50])
      : (activePanels.length === 3 ? [40, 20, 40] : [50, 50]);

    setLiveRatios(def);
    if (isTop) {
      if (activePanels.length === 3) {
        updateSettings({ layout: { sectionRatios: def } });
      } else {
        updateSettings({ layout: { twoPanelRatios: def } });
      }
    } else {
      if (activePanels.length === 3) {
        updateSettings({ layout: { sidebarSectionRatios: def } });
      } else {
        updateSettings({ layout: { twoPanelSidebarRatios: def } });
      }
    }
  };

  const renderPanelComponent = (panelId, index) => {
    const ratio = effectiveRatios[index] != null ? effectiveRatios[index] : (100 / activePanels.length);
    const isTop = mode === 'top';

    const panelStyle = isTop
      ? {
          flex: isSolo ? '1 1 100%' : `${ratio} 0 0%`,
          width: isSolo ? '100%' : `${ratio}%`,
          maxWidth: isSolo ? '100%' : `${ratio}%`,
          height: '100%',
          maxHeight: '100%',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          '--top-slot-flex': isSolo ? '1 1 100%' : `${ratio} 0 0%`,
          '--top-slot-width': isSolo ? '100%' : `${ratio}%`,
        }
      : {
          flex: isSolo ? '1 1 100%' : `${ratio} 0 0%`,
          height: isSolo ? '100%' : `${ratio}%`,
          maxHeight: isSolo ? '100%' : `${ratio}%`,
          width: '100%',
          maxWidth: '100%',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          '--sidebar-slot-flex': isSolo ? '1 1 100%' : `${ratio} 0 0%`,
          '--sidebar-slot-height': isSolo ? '100%' : `${ratio}%`,
        };

    const specificClass = panelId === 'nowPlaying'
      ? 'panel-left'
      : (panelId === 'lyrics' ? 'panel-center' : 'panel-right');

    switch (panelId) {
      case 'nowPlaying':
        return (
          <div key="nowPlaying" className={`panel-col ${specificClass} ${soloClass}`} style={panelStyle}>
            <ErrorBoundary name="NowPlaying" fallbackTitle="Now Playing failed to load">
              <NowPlaying
                track={currentTrack}
                isPlaying={isPlaying}
                progress={progress}
                duration={duration}
                volume={volume}
                systemVolume={systemVolume}
                systemMuted={systemMuted}
                shuffleState={shuffleState}
                repeatState={repeatState}
                devices={devices}
                currentDeviceId={currentTrack?.device?.id}
                onPlayPause={handlePlayPause}
                onSkip={handleSkip}
                onVolumeChange={handleVolumeChange}
                onSystemVolumeChange={handleSystemVolumeChange}
                onSystemMuteToggle={handleSystemMuteToggle}
                onProgressChange={handleProgressChange}
                onShuffle={handleShuffle}
                onRepeat={handleRepeat}
                onDeviceChange={handleDeviceChange}
              />
            </ErrorBoundary>
          </div>
        );
      case 'lyrics':
        return (
          <div key="lyrics" className={`panel-col ${specificClass} ${soloClass}`} style={panelStyle}>
            <ErrorBoundary name="LyricsPanel" fallbackTitle="Lyrics failed to load">
              <LyricsPanel
                lyrics={lyrics}
                currentIndex={currentLyricIndex}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                volume={systemVolume}
                isMuted={systemMuted}
                onVolumeChange={handleSystemVolumeChange}
                onMuteToggle={handleSystemMuteToggle}
                lyricsColor={settings.theming?.lyricsColor || 'white'}
                provider={lyricsProvider}
                lyricsOffsetMs={lyricsOffsetMs}
                onOffsetChange={setLyricsOffsetMs}
                onSeek={handleProgressChange}
              />
            </ErrorBoundary>
          </div>
        );
      case 'queue':
        return (
          <div key="queue" className={`panel-col ${specificClass} ${soloClass}`} style={panelStyle}>
            <ErrorBoundary name="QueuePanel" fallbackTitle="Queue failed to load">
              <QueuePanel
                queue={queue}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayQueueTrack}
                isAuthenticated={isAuthenticated}
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
              />
            </ErrorBoundary>
          </div>
        );
      default:
        return null;
    }
  };

  // Dynamic Island Floating Capsule Mode (Ctrl+Shift+M)
  if (isCompactMode) {
    return (
      <div className="dynamic-island-capsule">
        <div className="capsule-art-wrap">
          <img
            src={currentTrack?.albumArt || '/default-album-art.png'}
            alt=""
            className="capsule-art-img"
          />
          {isPlaying && <span className="capsule-dot-live" />}
        </div>
        <div className="capsule-meta">
          <MarqueeText
            text={currentTrack?.title || 'No track playing'}
            className="capsule-title"
            speed={28}
          />
          <span className="capsule-artist">{currentTrack?.artist || 'Spotify'}</span>
        </div>
        <div className="capsule-controls">
          <button
            type="button"
            className="capsule-btn-play"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={13} fill="#09090b" color="#09090b" />
            ) : (
              <Play size={13} fill="#09090b" color="#09090b" style={{ marginLeft: 1 }} />
            )}
          </button>
          <button
            type="button"
            className="capsule-btn-expand"
            onClick={() => window.electronAPI && window.electronAPI.toggleCompactMode && window.electronAPI.toggleCompactMode()}
            title="Expand to Full Dock (Ctrl+Shift+M)"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  const isSlideClass = isVisible ? 'slide-down' : 'slide-up';
  const positionClass = `position-${mode}`;
  const isOled = settings.theming?.preset === 'oled' || (settings.theming?.backdropStyle === 'solid' && (settings.theming?.solidColor === '#000000' || settings.theming?.solidColor === '#000'));

  return (
    <div
      className={`app ${isSlideClass} ${positionClass} ${mode !== 'top' ? 'sidebar-mode' : ''} ${isIsland && mode === 'top' ? 'app-island-mode' : ''} ${isOled ? 'mode-oled' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
      }}
    >
      {/* Blurred Album Art Mood Backdrop & Dark Scrim (Only for Album Art Reactive theme, disabled in island mode) */}
      {(settings.theming?.backdropStyle === 'artwork' || settings.theming?.preset === 'artwork') && currentTrack?.albumArt && !isIsland && (
        <div className="dock-backdrop-blur" aria-hidden="true">
          <img
            key={currentTrack.id || currentTrack.albumArt}
            src={currentTrack.albumArt}
            alt=""
            className="dock-bg-art"
          />
          <div className="dock-backdrop-scrim" />
        </div>
      )}

      {/* Main Dock Container (Modular & Reorderable Grid, or Square Dynamic Island) */}
      <div
        ref={dockContainerRef}
        className={`dock-container ${isIsland && mode === 'top' ? 'dock-island' : ''} ${isTwoPanelBalanced ? 'two-panel-balanced' : ''}`}
        style={{
          height: '100%',
          maxHeight: '100%',
          maxWidth: '100%',
          width: isIsland && mode === 'top' ? '100%' : undefined,
          borderRadius: isIsland && mode === 'top' ? `${settings.position?.islandShape === 'rectangle' ? 20 : 24}px` : undefined,
        }}
      >
        {mode !== 'top' ? (
          <SidebarDock
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            volume={volume}
            shuffleState={shuffleState}
            repeatState={repeatState}
            devices={devices}
            currentDeviceId={currentTrack?.device?.id}
            lyrics={lyrics}
            currentLyricIndex={currentLyricIndex}
            lyricsProvider={lyricsProvider}
            lyricsOffsetMs={lyricsOffsetMs}
            queue={queue}
            isAuthenticated={isAuthenticated}
            user={user}
            settings={settings}
            onPlayPause={handlePlayPause}
            onSkip={handleSkip}
            onVolumeChange={handleVolumeChange}
            systemVolume={systemVolume}
            systemMuted={systemMuted}
            onSystemVolumeChange={handleSystemVolumeChange}
            onSystemMuteToggle={handleSystemMuteToggle}
            onProgressChange={handleProgressChange}
            onShuffle={handleShuffle}
            onRepeat={handleRepeat}
            onDeviceChange={handleDeviceChange}
            onSeek={handleProgressChange}
            onPlayTrack={handlePlayQueueTrack}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onHideDock={() => {
              if (typeof window !== 'undefined' && window.electronAPI?.scrollHide) {
                window.electronAPI.scrollHide();
              }
            }}
          />
        ) : isIsland ? (
          <ErrorBoundary name="DynamicIsland" fallbackTitle="Floating Dynamic Island could not load">
            <SquareDynamicIsland
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              progress={progress}
              duration={duration}
              volume={volume}
              systemVolume={systemVolume}
              systemMuted={systemMuted}
              islandShape={settings.position?.islandShape || 'square'}
              shuffleState={shuffleState}
              repeatState={repeatState}
              lyrics={lyrics}
              currentLyricIndex={currentLyricIndex}
              queue={queue}
              onPlayPause={handlePlayPause}
              onSkip={handleSkip}
              onSeek={handleProgressChange}
              onShuffle={handleShuffle}
              onRepeat={handleRepeat}
              onPlayTrack={handlePlayQueueTrack}
              onVolumeChange={handleVolumeChange}
              onSystemVolumeChange={handleSystemVolumeChange}
              onSystemMuteToggle={handleSystemMuteToggle}
              onOpenSettings={() => {
                if (window.electronAPI?.openSettingsWindow) {
                  window.electronAPI.openSettingsWindow();
                }
              }}
            />
          </ErrorBoundary>
        ) : (
          activePanels.map((panelId, index) => (
            <React.Fragment key={panelId}>
              {renderPanelComponent(panelId, index)}
              {isSettingsOpen && index < activePanels.length - 1 && (
                <div
                  className={`panel-divider ${activeDividerIdx === index ? 'is-resizing' : ''}`}
                  onMouseDown={(e) => handleDividerMouseDown(e, index)}
                  onDoubleClick={handleDividerDoubleClick}
                  title="Drag to adjust section ratio (Double-click to reset)"
                  aria-label={`Adjust size between section ${index + 1} and ${index + 2}`}
                  role="separator"
                />
              )}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Interactive Bottom Resize Handle (Top Dock Mode) - Only available when Settings is open */}
      {isSettingsOpen && mode === 'top' && !isIsland && (
        <div
          className="dock-resize-handle"
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={handleResizeDoubleClick}
          title="Drag down or up to resize dock height (Double-click to reset)"
        >
          <span className="resize-handle-bar" />
        </div>
      )}

      {/* Interactive Edge Resize Handle (Left Sidebar Mode) - Only available when Settings is open */}
      {isSettingsOpen && mode === 'left' && (
        <div
          className="dock-resize-handle sidebar-resize-handle handle-right"
          onMouseDown={(e) => handleSidebarResizeMouseDown(e, 'left')}
          onDoubleClick={handleSidebarResizeDoubleClick}
          title="Drag left or right to resize sidebar width (Double-click to reset)"
        >
          <span className="resize-handle-bar vertical" />
        </div>
      )}

      {/* Interactive Edge Resize Handle (Right Sidebar Mode) - Only available when Settings is open */}
      {isSettingsOpen && mode === 'right' && (
        <div
          className="dock-resize-handle sidebar-resize-handle handle-left"
          onMouseDown={(e) => handleSidebarResizeMouseDown(e, 'right')}
          onDoubleClick={handleSidebarResizeDoubleClick}
          title="Drag left or right to resize sidebar width (Double-click to reset)"
        >
          <span className="resize-handle-bar vertical" />
        </div>
      )}
    </div>
  );
}

export default App;
