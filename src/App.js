import React, { useState, useEffect, useRef } from 'react';
import NowPlaying from './components/NowPlaying';
import LyricsPanel from './components/LyricsPanel';
import QueuePanel from './components/QueuePanel';
import LoginScreen from './components/LoginScreen';
import UserProfile from './components/UserProfile';
import SpotifyService from './services/SpotifyService';

function App() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dockDimensions, setDockDimensions] = useState({ width: 3000, height: 450 });
  const [authError, setAuthError] = useState(null);
  const [user, setUser] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [queue, setQueue] = useState([]);
  const [devices, setDevices] = useState([]);
  const [shuffleState, setShuffleState] = useState(false);
  const [repeatState, setRepeatState] = useState('off');
  const [lyrics, setLyrics] = useState([]);
  const [lyricsProvider, setLyricsProvider] = useState(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0); // user-adjustable offset from smooth version
  const [lyricsColor, setLyricsColor] = useState('white'); // Keep from original
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

  const handleLogin = async () => {
    try {
      setAuthError(null);
      await SpotifyService.authenticate();
      setIsAuthenticated(true);
      const profile = await SpotifyService.getCurrentUser();
      setUser(profile || null);
      updateSpotifyData();
    } catch (error) {
      setAuthError(error.message || 'Login failed. Check your Spotify Client ID in config.');
      console.error('Login error:', error);
    }
  };

  useEffect(() => {
    // Listen for dock visibility changes from Electron
    if (window.electronAPI) {
      window.electronAPI.onDockVisibilityChange((visible) => {
        setIsVisible(visible);
      });
      
      // Listen for dock dimensions from Electron
      window.electronAPI.onDockDimensions((dimensions) => {
        setDockDimensions(dimensions);
      });
    }

    SpotifyService.init();
    const checkAuth = async () => {
      try {
        const hasTokens = window.electronAPI ? await window.electronAPI.spotifyHasTokens() : false;
        setIsAuthenticated(!!hasTokens);
        if (hasTokens) {
          const profile = await SpotifyService.getCurrentUser();
          setUser(profile || null);
          updateSpotifyData();
        }
      } catch (e) {
        console.warn('checkAuth failed:', e);
      }
    };
    checkAuth();
    try {
      SpotifyService.onLogoutDone(() => setIsAuthenticated(false));
    } catch (_) {}

    // Set up event listeners for mouse enter/leave
    const handleMouseEnter = () => {
      if (window.electronAPI) {
        window.electronAPI.onMouseEnter();
      }
    };

    const handleMouseLeave = () => {
      if (window.electronAPI) {
        window.electronAPI.onMouseLeave();
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Adaptive polling strategy (keeping original advanced features)
    const startPolling = () => {
      // Player state polling - adaptive based on playing state
      const pollPlayer = () => {
        updatePlayerState();
        const nextInterval = isPlayingRef.current ? 1500 : 3000;
        playerPollIntervalRef.current = setTimeout(pollPlayer, nextInterval);
      };
      pollPlayer();

      // Queue polling - every 10 seconds
      const pollQueue = () => {
        updateQueue();
        queuePollIntervalRef.current = setTimeout(pollQueue, 10000);
      };
      setTimeout(pollQueue, 2000);

      // Devices polling - every 15 seconds
      const pollDevices = () => {
        updateDevices();
        devicesPollIntervalRef.current = setTimeout(pollDevices, 15000);
      };
      setTimeout(pollDevices, 3000);
    };

    startPolling();

    // When internet comes back online, refetch immediately
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
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Separate function for player state (keeping advanced retry logic)
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
    
    if (trackData) {
      setIsAuthenticated(true);
      setAuthError(null);
      setCurrentTrack(trackData);
      lastValidTrackRef.current = trackData;
      nullResponseTimeRef.current = null;
      setIsPlaying(!!trackData.isPlaying);
      isPlayingRef.current = !!trackData.isPlaying;

      let durationSec = trackData.durationMs ?? trackData.duration ?? 0;
      durationSec = durationSec > 10000 ? durationSec / 1000 : durationSec;
      let progressSec = trackData.progressMs ?? trackData.progress ?? 0;
      progressSec = progressSec > 10000 ? progressSec / 1000 : progressSec;
      if (trackData.serverTimestamp && trackData.isPlaying) {
        const serverTs = new Date(trackData.serverTimestamp).getTime();
        if (!Number.isNaN(serverTs)) {
          progressSec += Math.max(0, (Date.now() - serverTs) / 1000);
        }
      }
      if (durationSec > 0) progressSec = Math.max(0, Math.min(progressSec, durationSec));
      baseProgressSecRef.current = progressSec;
      baseTimestampMsRef.current = Date.now();
      setProgress(progressSec);
      setDuration(durationSec);
      if (typeof trackData.volume === 'number') setVolume(trackData.volume);
      if (typeof trackData.shuffleState === 'boolean') setShuffleState(trackData.shuffleState);
      if (trackData.repeatState) setRepeatState(trackData.repeatState);
    } else {
      // Grace period logic (keeping original advanced feature)
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

    // SMOOTH LYRICS LOGIC from second file - handles both new tracks AND missing lyrics
    const newTrackId = trackData?.id || trackData?.trackId || trackData?.track?.id || null;
    if (newTrackId !== lastTrackIdRef.current) {
      lastTrackIdRef.current = newTrackId;
      setLyrics([]);
      setLyricsProvider(null);
      setCurrentLyricIndex(0);
      if (newTrackId) {
        SpotifyService.getLyrics(newTrackId, trackData).then(({ lines: lyricsData, provider }) => {
          if (lyricsData && lyricsData.length) {
            setLyrics(lyricsData);
            setLyricsProvider(provider);
            updateCurrentLyric(baseProgressSecRef.current || 0, lyricsData);
          }
        }).catch(() => {});
      }
    } else if ((!lyrics || lyrics.length === 0) && newTrackId) {
      // KEY IMPROVEMENT: Retry lyrics fetch if we have track but no lyrics yet
      SpotifyService.getLyrics(newTrackId, trackData).then(({ lines: lyricsData, provider }) => {
        if (lyricsData && lyricsData.length) {
          setLyrics(lyricsData);
          setLyricsProvider(provider);
          updateCurrentLyric(baseProgressSecRef.current || 0, lyricsData);
        }
      }).catch(() => {});
    }
  };

  // Keep original queue and devices functions
  const updateQueue = async () => {
    const now = Date.now();
    if (now - lastQueueFetchRef.current < 8000) return;
    lastQueueFetchRef.current = now;

    try {
      const queueData = await SpotifyService.getQueue();
      if (queueData) {
        const raw = queueData.items || [];
        const seen = new Set();
        const unique = raw.filter((t) => {
          const id = t.id || t.uri;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const limitedQueue = { ...queueData, items: unique.slice(0, 4) };
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

    // Smooth offset logic from second file
    const offsetSec = Math.abs(lyricsOffsetMs) > 100 ? lyricsOffsetMs / 1000 : lyricsOffsetMs;
    const t = Math.max(0, currentTime + offsetSec);

    const currentIndex = lyricsArray.findIndex((lyric, index) => {
      const nextLyric = lyricsArray[index + 1];
      return t >= lyric.startTime && (!nextLyric || t < nextLyric.startTime);
    });

    if (currentIndex !== -1 && currentIndex !== currentLyricIndex) {
      setCurrentLyricIndex(currentIndex);
    }
  };

  // Smooth ticking (same in both files)
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
      }, 250);
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isPlaying, duration, lyrics]);

  // All original control handlers (keeping all features)
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
    try {
      await SpotifyService.setVolume(newVolume);
      setVolume(newVolume);
    } catch (error) {
      console.error('Error changing volume:', error);
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
      await SpotifyService.transferPlayback([deviceId], true);
    } catch (err) {
      console.error('Error transferring playback:', err);
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div 
        className={`app ${isVisible ? 'slide-down' : 'slide-up'}`}
        style={{ 
          opacity: isVisible ? 1 : 0,
          visibility: isVisible ? 'visible' : 'hidden',
          width: `${dockDimensions.width}px`,
          height: `${dockDimensions.height}px`
        }}
      >
        <div className="dock-container login-container" style={{ width: `${dockDimensions.width}px`, height: `${dockDimensions.height}px` }}>
          <LoginScreen onLogin={handleLogin} error={authError} />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`app ${isVisible ? 'slide-down' : 'slide-up'}`}
      style={{ 
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden',
        width: `${dockDimensions.width}px`,
        height: `${dockDimensions.height}px`
      }}
    >
      <div className="dock-container" style={{ width: `${dockDimensions.width}px`, height: `${dockDimensions.height}px` }}>
        <div className="dock-header">
          {apiError && <span className="api-error">Open Spotify or check connection</span>}
          <UserProfile user={user} onLogout={handleLogout} />
        </div>
        <div className="panel-left">
          <NowPlaying
            track={currentTrack}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            volume={volume}
            shuffleState={shuffleState}
            repeatState={repeatState}
            devices={devices}
            currentDeviceId={currentTrack?.device?.id}
            onPlayPause={handlePlayPause}
            onSkip={handleSkip}
            onVolumeChange={handleVolumeChange}
            onProgressChange={handleProgressChange}
            onShuffle={handleShuffle}
            onRepeat={handleRepeat}
            onDeviceChange={handleDeviceChange}
          />
        </div>
        <div className="panel-center">
          <LyricsPanel
            lyrics={lyrics}
            currentIndex={currentLyricIndex}
            volume={volume}
            onVolumeChange={handleVolumeChange}
            lyricsColor={lyricsColor}
            provider={lyricsProvider}           // Added from smooth version
            lyricsOffsetMs={lyricsOffsetMs}     // Added from smooth version
            onOffsetChange={setLyricsOffsetMs}  // Added from smooth version
          />
        </div>
        <div className="panel-right">
          <QueuePanel
            queue={queue}
            onPlayTrack={(uri) => SpotifyService.playTrack(uri)}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
