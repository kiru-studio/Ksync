import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Volume2,
  VolumeX,
  Monitor,
  ChevronUp,
  Music,
  Sparkles,
  LogIn,
} from 'lucide-react';
import MarqueeText from './MarqueeText';
import SpotifyService from '../services/SpotifyService';

const WAVE_BARS = [
  30, 42, 60, 80, 50, 38, 70, 95, 82, 58, 44, 76, 92, 100, 72, 48, 64, 88, 96,
  78, 54, 40, 62, 82, 92, 74, 52, 66, 84, 98, 68, 46, 58, 48, 36, 26,
];

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined) return '0:00';
  const totalSec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(msOrSec) {
  if (!msOrSec) return '';
  const totalSec = msOrSec > 1000 ? Math.floor(msOrSec / 1000) : Math.floor(msOrSec);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function cleanStringForMatch(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*[\(\[](feat|ft|with|from|remaster|mix|version|deluxe|bonus|radio|edit|live|mono|stereo|anniversary).*?[\)\]]/gi, '')
    .replace(/\s*-\s*(from|remaster|mix|version|radio|edit|live|mono|stereo|bonus|deluxe).*$/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

function isTrackMatch(track, currentTrack) {
  if (!track || !currentTrack) return false;
  if (track.id && currentTrack.id && !track.id.startsWith('smtc-') && !currentTrack.id.startsWith('smtc-')) {
    if (track.id === currentTrack.id) return true;
  }
  if (track.uri && currentTrack.uri && track.uri === currentTrack.uri) return true;
  const tTitle = cleanStringForMatch(track.title || track.name);
  const cTitle = cleanStringForMatch(currentTrack.title || currentTrack.name);
  if (!tTitle || !cTitle || tTitle !== cTitle) return false;
  const tArtist = cleanStringForMatch(track.artist || (track.artists ? track.artists.map((a) => a.name).join(' ') : ''));
  const cArtist = cleanStringForMatch(currentTrack.artist);
  if (tArtist && cArtist) {
    if (tArtist.includes(cArtist) || cArtist.includes(tArtist)) return true;
    return tTitle.length >= 4;
  }
  return true;
}

export default function SidebarDock({
  currentTrack,
  isPlaying = false,
  progress = 0,
  duration = 0,
  volume = 50,
  shuffleState = false,
  repeatState = 'off',
  devices = [],
  currentDeviceId = null,
  lyrics = [],
  currentLyricIndex = -1,
  queue = null,
  isAuthenticated = false,
  onPlayPause,
  onSkip,
  onVolumeChange,
  onProgressChange,
  onShuffle,
  onRepeat,
  onDeviceChange,
  onSeek,
  onPlayTrack,
  onLogin,
  onHideDock,
}) {
  const [localVolume, setLocalVolume] = useState(volume ?? 50);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const volThrottleTimerRef = useRef(null);
  const latestVolRef = useRef(volume ?? 50);

  const deviceList = useMemo(() => (Array.isArray(devices) ? devices : []), [devices]);
  const currentDevice = useMemo(
    () => deviceList.find((d) => d.id === currentDeviceId) || deviceList.find((d) => d.is_active),
    [deviceList, currentDeviceId]
  );

  // Queue hover drawer state
  const [isQueueHovered, setIsQueueHovered] = useState(false);
  const queueLeaveTimerRef = useRef(null);

  // Seekbar hover state
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [hoverPercent, setHoverPercent] = useState(0);
  const [hoverTime, setHoverTime] = useState(null);

  // Lyrics auto-centering refs
  const lyricsScrollerRef = useRef(null);
  const activeLyricRef = useRef(null);

  useEffect(() => {
    if (typeof volume === 'number') {
      setLocalVolume(volume);
      latestVolRef.current = volume;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (volThrottleTimerRef.current) clearTimeout(volThrottleTimerRef.current);
      if (queueLeaveTimerRef.current) clearTimeout(queueLeaveTimerRef.current);
    };
  }, []);

  // Synchronize Like / Heart status with Spotify & localStorage
  useEffect(() => {
    if (!currentTrack || !currentTrack.title) {
      setIsLiked(false);
      return;
    }

    const trackKey = `${(currentTrack.title || '').toLowerCase().trim()}:::${(currentTrack.artist || '').toLowerCase().trim()}`;
    try {
      const local = JSON.parse(localStorage.getItem('ksync_liked_tracks') || '{}');
      if (typeof local[trackKey] === 'boolean') {
        setIsLiked(local[trackKey]);
      }
    } catch (_) { }

    SpotifyService.checkSavedTracks({
      trackId: currentTrack.id,
      title: currentTrack.title,
      artist: currentTrack.artist,
    }).then((saved) => {
      if (typeof saved === 'boolean') {
        setIsLiked(saved);
        try {
          const local = JSON.parse(localStorage.getItem('ksync_liked_tracks') || '{}');
          local[trackKey] = saved;
          localStorage.setItem('ksync_liked_tracks', JSON.stringify(local));
        } catch (_) { }
      }
    }).catch(() => { });
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist]);

  const handleToggleLike = async () => {
    if (!currentTrack) return;
    const nextState = !isLiked;
    setIsLiked(nextState);

    const trackKey = `${(currentTrack.title || '').toLowerCase().trim()}:::${(currentTrack.artist || '').toLowerCase().trim()}`;
    try {
      const local = JSON.parse(localStorage.getItem('ksync_liked_tracks') || '{}');
      local[trackKey] = nextState;
      localStorage.setItem('ksync_liked_tracks', JSON.stringify(local));
    } catch (_) { }

    try {
      await SpotifyService.toggleSaveTrack({
        trackId: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        shouldSave: nextState,
      });
    } catch (err) {
      console.warn('[SidebarDock] Failed to toggle like:', err);
    }
  };

  const dispatchVolume = (newVol, immediate = false) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVol)));
    setLocalVolume(clamped);
    latestVolRef.current = clamped;

    if (immediate) {
      if (volThrottleTimerRef.current) {
        clearTimeout(volThrottleTimerRef.current);
        volThrottleTimerRef.current = null;
      }
      if (onVolumeChange) onVolumeChange(clamped);
      return;
    }

    if (!volThrottleTimerRef.current) {
      volThrottleTimerRef.current = setTimeout(() => {
        volThrottleTimerRef.current = null;
        if (onVolumeChange) onVolumeChange(latestVolRef.current);
      }, 60);
    }
  };

  const handleWheelVolume = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 3 : -3;
    dispatchVolume(localVolume + delta, true);
  };

  // Queue item resolution
  const queueItems = useMemo(() => {
    if (!queue) return [];
    if (Array.isArray(queue)) return queue;
    if (Array.isArray(queue.items)) return queue.items;
    return [];
  }, [queue]);

  const currentIndexInQueue = useMemo(() => {
    if (!queueItems.length || !currentTrack) return -1;
    return queueItems.findIndex((t) => isTrackMatch(t, currentTrack));
  }, [queueItems, currentTrack]);

  const nextTrack = useMemo(() => {
    if (!queueItems.length) return null;
    if (currentIndexInQueue >= 0 && currentIndexInQueue + 1 < queueItems.length) {
      return queueItems[currentIndexInQueue + 1];
    }
    if (currentIndexInQueue === -1 && queueItems.length > 0) {
      return queueItems[0];
    }
    return null;
  }, [queueItems, currentIndexInQueue]);

  // Queue Drawer hover handling with hysteresis
  const handleQueueMouseEnter = () => {
    if (queueLeaveTimerRef.current) {
      clearTimeout(queueLeaveTimerRef.current);
      queueLeaveTimerRef.current = null;
    }
    setIsQueueHovered(true);
  };

  const handleQueueMouseLeave = () => {
    if (queueLeaveTimerRef.current) clearTimeout(queueLeaveTimerRef.current);
    queueLeaveTimerRef.current = setTimeout(() => {
      setIsQueueHovered(false);
    }, 180);
  };

  // Prepare display lines with instrumental intro if track starts after 2s
  const { displayLines, hasIntro } = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return { displayLines: [], hasIntro: false };
    const firstStart = lyrics[0]?.startTime || 0;
    if (firstStart > 2) {
      return {
        displayLines: [
          { text: 'Instrumental Intro', startTime: 0, isIntro: true },
          ...lyrics,
        ],
        hasIntro: true,
      };
    }
    return { displayLines: lyrics, hasIntro: false };
  }, [lyrics]);

  // Compute active index
  const activeIndex = useMemo(() => {
    if (displayLines.length === 0) return 0;
    if (hasIntro) {
      return currentLyricIndex < 0 ? 0 : currentLyricIndex + 1;
    }
    return Math.max(0, currentLyricIndex);
  }, [currentLyricIndex, hasIntro, displayLines.length]);

  // Always compute exactly 5 windowed lines around activeIndex: [-2, -1, 0, 1, 2]
  const windowedLyrics = useMemo(() => {
    if (displayLines.length === 0) return [];
    return [-2, -1, 0, 1, 2].map((delta) => {
      const targetIdx = activeIndex + delta;
      if (targetIdx >= 0 && targetIdx < displayLines.length) {
        return {
          ...displayLines[targetIdx],
          delta,
          key: `line-${targetIdx}`,
          isEmpty: false,
        };
      }
      return {
        text: '',
        delta,
        key: `empty-${delta}-${targetIdx}`,
        isEmpty: true,
      };
    });
  }, [displayLines, activeIndex]);

  // Seekbar calculations
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  const remaining = duration > progress ? duration - progress : 0;

  const handleProgressClick = (e) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newSec = pct * duration;
    if (onProgressChange) onProgressChange(newSec);
  };

  const handleSeekMouseMove = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setHoverPercent(pct * 100);
    setHoverTime(pct * duration);
  };

  const cycleRepeat = () => {
    if (!onRepeat) return;
    if (repeatState === 'off') onRepeat('context');
    else if (repeatState === 'context') onRepeat('track');
    else onRepeat('off');
  };

  // Context Header Titles (matches mock: "Playing from Playlist" / "Avalin kural")
  const { contextSubText, contextMainText } = useMemo(() => {
    const raw =
      currentTrack?.contextTitle ||
      queue?.source ||
      queue?.rawSource ||
      queue?.meta?.source;

    if (raw && typeof raw === 'string') {
      const isPlaylist = /^playlist:\s*/i.test(raw);
      const isAlbum = /^album:\s*/i.test(raw);
      const isArtist = /^artist:\s*/i.test(raw);
      const clean = raw.replace(/^(playlist:\s*|album:\s*|artist:\s*)/i, '').trim();
      if (clean && clean !== 'Up Next' && clean !== 'Queue' && clean !== 'Recently Played') {
        if (isPlaylist) return { contextSubText: 'Playing from Playlist', contextMainText: clean };
        if (isAlbum) return { contextSubText: 'Playing from Album', contextMainText: clean };
        if (isArtist) return { contextSubText: 'Playing from Artist', contextMainText: clean };
        return { contextSubText: 'Playing from', contextMainText: clean };
      }
    }
    if (currentTrack?.album) {
      return { contextSubText: 'Playing from Album', contextMainText: currentTrack.album };
    }
    return { contextSubText: 'Playing from', contextMainText: 'Spotify' };
  }, [currentTrack?.contextTitle, queue?.source, queue?.rawSource, queue?.meta?.source, currentTrack?.album]);

  return (
    <div className="sidebar-dock-root">
      {/* 1. TOP HEADER: Centered Playing from Playlist / Album Context */}
      <div className="sidebar-top-bar">
        <div className="sidebar-context-group" title={`${contextSubText}: ${contextMainText}`}>
          <span className="sidebar-context-sub">{contextSubText}</span>
          <span className="sidebar-context-main">{contextMainText}</span>
        </div>
      </div>

      {/* 2. BIG SQUARE ALBUM ARTWORK */}
      <div className="sidebar-art-container">
        <div className="sidebar-art-card">
          <img
            src={currentTrack?.albumArt || '/default-album-art.png'}
            alt=""
            className="sidebar-art-image"
            onError={(e) => {
              e.currentTarget.src = '/default-album-art.png';
            }}
          />
        </div>
      </div>

      {/* 3. IN THE MIDDLE: 5-LINE SYNCHRONIZED LYRICS (B4 2, CURRENT, NEXT 2) */}
      <div className="sidebar-middle-lyrics-zone">
        {displayLines.length > 0 ? (
          <div className="sidebar-lyrics-scroller" ref={lyricsScrollerRef}>
            {windowedLyrics.map((item) => {
              if (item.isEmpty) {
                return (
                  <div key={item.key} className="sidebar-lyric-item lyric-empty" aria-hidden="true">
                    &nbsp;
                  </div>
                );
              }

              const isActive = item.delta === 0;
              const isNear = Math.abs(item.delta) === 1;
              const isSeekable = typeof item.startTime === 'number' && !item.isIntro && !!onSeek;

              let lineClass = 'lyric-far';
              if (isActive) lineClass = 'lyric-active';
              else if (isNear) lineClass = 'lyric-near';

              return (
                <div
                  key={item.key}
                  className={`sidebar-lyric-item ${lineClass} ${isSeekable ? 'is-seekable' : ''}`}
                  onClick={() => {
                    if (isSeekable) onSeek(item.startTime);
                  }}
                  title={isSeekable ? `Jump to ${formatTime(item.startTime)}` : item.text}
                >
                  {item.isIntro ? (
                    <div className="sidebar-interlude-pill">
                      <Music size={13} />
                      <span>Instrumental Intro</span>
                    </div>
                  ) : (
                    <span className="lyric-content-text">{item.text}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="sidebar-ambient-card">
            <div className="sidebar-ambient-chip">
              <Sparkles size={11} />
              <span>{currentTrack?.title ? 'Synced Lyrics Unavailable • Pure Audio' : 'Ready for playback'}</span>
            </div>
            <div className={`sidebar-ambient-eq ${isPlaying ? 'playing' : ''}`}>
              {[25, 45, 75, 95, 70, 50, 85, 100, 65, 35, 55, 90, 80, 45, 30].map((h, i) => (
                <span
                  key={i}
                  className="sidebar-eq-bar"
                  style={{
                    '--eq-h': `${h}%`,
                    '--eq-delay': `${(i % 5) * -0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. COMPACT PLAYBACK SECTION (Track Info + Centered Controls + Seekbar) */}
      <div className="sidebar-playback-section">
        {/* Track Title & Artist (Left) + Quick Actions (Heart, Device, Volume) (Right) */}
        <div className="sidebar-track-row">
          <div className="sidebar-track-info-col">
            <MarqueeText
              text={currentTrack?.title || 'No Track Playing'}
              className="sidebar-title-text"
              speed={26}
              gap={30}
            />
            <MarqueeText
              text={currentTrack?.artist || 'Open Spotify to start playback'}
              className="sidebar-artist-text"
              speed={20}
              gap={24}
            />
          </div>

          <div className="sidebar-track-actions">
            {/* Heart / Like Button */}
            <button
              type="button"
              className={`sidebar-action-btn ${isLiked ? 'liked' : ''}`}
              onClick={handleToggleLike}
              title={isLiked ? 'Remove from Your Library' : 'Save to Your Library'}
              aria-label="Like"
            >
              <Heart
                size={18}
                fill={isLiked ? '#ffffff' : 'none'}
                color={isLiked ? '#ffffff' : 'currentColor'}
              />
            </button>

            {/* Device Picker */}
            {deviceList.length > 0 && (
              <div className="sidebar-device-anchor">
                <button
                  type="button"
                  className="sidebar-action-btn"
                  onClick={() => setShowDevices(!showDevices)}
                  title={currentDevice ? `Playing on ${currentDevice.name}` : 'Select device'}
                  aria-label="Devices"
                >
                  <Monitor size={18} />
                </button>
                {showDevices && (
                  <ul className="sidebar-device-dropdown">
                    {deviceList.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          className={d.id === currentDeviceId ? 'active' : ''}
                          onClick={() => {
                            if (onDeviceChange) onDeviceChange(d.id);
                            setShowDevices(false);
                          }}
                        >
                          {d.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Volume Button with Popover */}
            <div
              className="sidebar-volume-anchor"
              onMouseEnter={() => setShowVolumePopup(true)}
              onMouseLeave={() => setShowVolumePopup(false)}
            >
              <button
                type="button"
                className="sidebar-action-btn"
                onClick={() => dispatchVolume(localVolume === 0 ? 50 : 0, true)}
                onWheel={handleWheelVolume}
                title={`Volume: ${localVolume}% (Scroll to adjust)`}
                aria-label="Volume"
              >
                {localVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              {showVolumePopup && (
                <div className="sidebar-volume-popup" onWheel={handleWheelVolume}>
                  <div
                    className="sidebar-vol-bar"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      dispatchVolume(pct * 100, true);
                    }}
                  >
                    <div className="sidebar-vol-bar-fill" style={{ width: `${localVolume}%` }} />
                  </div>
                  <span className="sidebar-vol-text">{localVolume}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. MEDIA CONTROLS (Shuffle, Prev, Big Circle Play IN EXACT CENTER, Next, Repeat) */}
        <div className="sidebar-controls-container">
          <button
            type="button"
            className={`sidebar-ctrl-btn ${shuffleState ? 'active' : ''}`}
            onClick={() => onShuffle && onShuffle(!shuffleState)}
            title={shuffleState ? 'Disable Shuffle' : 'Enable Shuffle'}
            aria-label="Shuffle"
          >
            <Shuffle size={18} />
          </button>

          <button
            type="button"
            className="sidebar-ctrl-btn"
            onClick={() => onSkip && onSkip('previous')}
            title="Previous Track"
            aria-label="Previous"
          >
            <SkipBack size={22} fill="currentColor" />
          </button>

          {/* Large Circular Play/Pause Button - GUARANTEED DEAD CENTER (Item 3 of 5) */}
          <button
            type="button"
            className="sidebar-main-play-circle"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={22} fill="#000000" color="#000000" />
            ) : (
              <Play size={22} fill="#000000" color="#000000" style={{ marginLeft: '2px' }} />
            )}
          </button>

          <button
            type="button"
            className="sidebar-ctrl-btn"
            onClick={() => onSkip && onSkip('next')}
            title="Next Track"
            aria-label="Next"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>

          <button
            type="button"
            className={`sidebar-ctrl-btn ${repeatState !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            title={`Repeat: ${repeatState}`}
            aria-label={`Repeat: ${repeatState}`}
          >
            {repeatState === 'track' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>

        {/* 6. SEEKBAR ROW: Interactive Wave Scrubber (matching top dock) */}
        <div className="sidebar-seekbar-row">
          <span className="sidebar-time-val">{formatTime(progress)}</span>
          <div
            className={`sidebar-seekbar-bar wave-seekbar-track ${isHoveringSeek ? 'hovered' : ''}`}
            onClick={handleProgressClick}
            onMouseEnter={() => setIsHoveringSeek(true)}
            onMouseLeave={() => setIsHoveringSeek(false)}
            onMouseMove={handleSeekMouseMove}
            style={{ cursor: currentTrack?.canSeek === false ? 'default' : 'pointer' }}
          >
            {isHoveringSeek && hoverTime !== null && (
              <div className="sidebar-seek-tooltip" style={{ left: `${hoverPercent}%` }}>
                {formatTime(hoverTime)}
              </div>
            )}

            {/* Bouncing Audio Wave Bars (Active when playing) */}
            <div className={`wave-bars-container ${isPlaying ? 'is-playing' : 'is-paused'}`}>
              {WAVE_BARS.map((baseHeight, idx) => {
                const barPct = (idx / (WAVE_BARS.length - 1)) * 100;
                const isPlayed = barPct <= progressPercent;
                const isHovered = isHoveringSeek && barPct <= hoverPercent;

                return (
                  <span
                    key={idx}
                    className={`wave-bar ${isPlayed ? 'played' : 'unplayed'} ${isHovered ? 'hover-fill' : ''}`}
                    style={{
                      '--bar-base-h': `${baseHeight}%`,
                      '--bar-delay': `${(idx % 8) * -0.12}s`,
                    }}
                  />
                );
              })}
            </div>

            {/* Flat Progress Bar (Active when paused) */}
            <div className={`flat-progress-container ${!isPlaying ? 'active' : ''}`}>
              <div
                className="flat-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Seek Thumb Scrubber */}
            <div
              className={`wave-thumb ${isHoveringSeek ? 'visible' : ''}`}
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <span
            className="sidebar-time-val time-toggle-btn"
            onClick={() => setShowRemaining(!showRemaining)}
            title={showRemaining ? 'Show total duration' : 'Show remaining time'}
          >
            {showRemaining ? `-${formatTime(remaining)}` : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 7. BELOW SPACE: SHOW NEXT SONG (Hover to expand queue) */}
      <div
        className={`sidebar-next-song-card ${isQueueHovered ? 'expanded' : ''}`}
        onMouseEnter={handleQueueMouseEnter}
        onMouseLeave={handleQueueMouseLeave}
      >
        {/* Collapsed Bar: Up Next Preview */}
        <div className="sidebar-next-song-header">
          <div className="sidebar-next-song-left">
            {nextTrack?.albumArt ? (
              <img
                src={nextTrack.albumArt}
                alt=""
                className="sidebar-next-thumb"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="sidebar-next-thumb-placeholder">
                <Music size={13} />
              </div>
            )}
            <div className="sidebar-next-text-col">
              <span className="sidebar-next-label">UP NEXT</span>
              <span className="sidebar-next-title">
                {nextTrack
                  ? `${nextTrack.title || 'Unknown Title'} • ${nextTrack.artist || 'Unknown Artist'}`
                  : 'Open queue to view upcoming tracks'}
              </span>
            </div>
          </div>
          <ChevronUp size={16} className={`sidebar-next-chevron ${isQueueHovered ? 'open' : ''}`} />
        </div>

        {/* Expanded Queue List (Reveals on hover) */}
        <div className="sidebar-queue-slideout">
          <div className="sidebar-queue-slideout-header">
            <span className="queue-badge-title">Upcoming Queue ({queueItems.length})</span>
            {!isAuthenticated && onLogin && (
              <button type="button" className="sidebar-queue-login-pill" onClick={onLogin}>
                <LogIn size={11} />
                <span>Connect</span>
              </button>
            )}
          </div>
          <div className="sidebar-queue-scroll-area">
            {queueItems.length > 0 ? (
              queueItems.map((item, idx) => {
                const isCur = isTrackMatch(item, currentTrack);
                const itemUri = item.uri || (item.id ? (item.id.startsWith('spotify:') ? item.id : `spotify:track:${item.id}`) : null);
                let queueOffset = currentIndexInQueue >= 0 ? idx - currentIndexInQueue : idx + 1;

                return (
                  <div
                    key={item.id || item.uri || idx}
                    className={`sidebar-queue-item ${isCur ? 'is-playing-now' : ''}`}
                    onClick={() => onPlayTrack && onPlayTrack(itemUri, queueOffset, item, queue?.meta?.contextUri)}
                    role="button"
                    tabIndex={0}
                  >
                    <img
                      src={item.albumArt || '/default-album-art.png'}
                      alt=""
                      className="sidebar-queue-item-art"
                      onError={(e) => {
                        e.currentTarget.src = '/default-album-art.png';
                      }}
                    />
                    <div className="sidebar-queue-item-meta">
                      <div className="queue-item-title">{item.title || 'Unknown Title'}</div>
                      <div className="queue-item-artist">{item.artist || 'Unknown Artist'}</div>
                    </div>
                    <span className="queue-item-time">
                      {formatDuration(item.duration_ms || item.duration)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="sidebar-queue-none">
                <span>{isAuthenticated ? 'No upcoming tracks in queue' : 'Connect Spotify to see full queue'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
