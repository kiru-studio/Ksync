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
  ListMusic,
  ChevronUp,
  Monitor,
  Music,
  Sparkles,
  X,
  LogIn,
} from 'lucide-react';
import MarqueeText from './MarqueeText';
import SpotifyService from '../services/SpotifyService';
import { useSettings } from '../context/SettingsContext';

const WAVE_BARS = [
  28, 44, 65, 85, 52, 36, 74, 98, 80, 55, 42, 78, 92, 100, 70, 46, 62, 88, 96,
  76, 50, 38, 60, 84, 90, 72, 48, 64, 86, 94, 66, 44, 56, 42, 32, 24,
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
  currentDeviceId,
  lyrics = [],
  currentLyricIndex = -1,
  lyricsProvider = null,
  lyricsOffsetMs = 0,
  queue = null,
  isAuthenticated = false,
  user = null,
  settings = {},
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
  onLogout,
  onHideDock,
}) {
  // Volume state & throttle
  const [localVolume, setLocalVolume] = useState(volume ?? 50);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const volThrottleTimerRef = useRef(null);
  const latestVolRef = useRef(volume ?? 50);

  // Queue Hover Drawer state
  const [isQueueHovered, setIsQueueHovered] = useState(false);
  const queueLeaveTimerRef = useRef(null);

  // Seekbar hover state
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [hoverPercent, setHoverPercent] = useState(0);
  const [hoverTime, setHoverTime] = useState(null);

  // Lyrics container & scrolling refs
  const lyricsContainerRef = useRef(null);
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
    } catch (_) {}

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
        } catch (_) {}
      }
    }).catch(() => {});
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
    } catch (_) {}

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

  // Auto-scroll active lyric into center of lyrics view
  useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }, [currentLyricIndex]);

  // Seekbar handlers
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

  // Context Tag text
  const contextTag = useMemo(() => {
    if (queue?.rawSource) {
      const isPlaylist = /^playlist:\s*/i.test(queue.rawSource);
      const isAlbum = /^album:\s*/i.test(queue.rawSource);
      const clean = queue.rawSource.replace(/^(playlist:\s*|album:\s*)/i, '').trim();
      if (isPlaylist) return `PLAYLIST · ${clean.toUpperCase()}`;
      if (isAlbum) return `ALBUM · ${clean.toUpperCase()}`;
      return clean.toUpperCase();
    }
    if (currentTrack?.album) return `ALBUM · ${currentTrack.album.toUpperCase()}`;
    return 'NOW PLAYING';
  }, [queue?.rawSource, currentTrack?.album]);

  return (
    <div className="sidebar-dock-root">
      {/* 1. TOP HEADER: Song Title & Metadata */}
      <div className="sidebar-header-card">
        <div className="sidebar-header-top-row">
          <span className="sidebar-context-badge" title={contextTag}>
            {contextTag}
          </span>
          <div className="sidebar-header-actions">
            <button
              type="button"
              className={`sidebar-icon-btn ${isLiked ? 'liked' : ''}`}
              onClick={handleToggleLike}
              title={isLiked ? 'Remove from Library' : 'Save to Library'}
              aria-label="Save to Library"
            >
              <Heart
                size={15}
                fill={isLiked ? 'var(--accent, #10b981)' : 'none'}
                color={isLiked ? 'var(--accent, #10b981)' : 'currentColor'}
              />
            </button>
            {onHideDock && (
              <button
                type="button"
                className="sidebar-icon-btn close-btn"
                onClick={onHideDock}
                title="Hide Dock"
                aria-label="Hide Dock"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-meta-text">
          <MarqueeText
            text={currentTrack?.title || 'No Track Playing'}
            className="sidebar-track-title"
            speed={28}
            gap={32}
          />
          <MarqueeText
            text={currentTrack?.artist || 'Open Spotify to start playback'}
            className="sidebar-track-artist"
            speed={22}
            gap={26}
          />
        </div>
      </div>

      {/* 2. ALBUM ARTWORK */}
      <div className="sidebar-art-container">
        <div className="sidebar-art-wrapper">
          <img
            src={currentTrack?.albumArt || '/default-album-art.png'}
            alt=""
            className="sidebar-art-img"
            onError={(e) => {
              e.currentTarget.src = '/default-album-art.png';
            }}
          />
          {isPlaying && (
            <div className="sidebar-art-playing-badge" title="Playing">
              <span className="sidebar-art-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* 3. CENTER ZONE: LYRICS (The Star of the Show) */}
      <div className="sidebar-lyrics-zone" ref={lyricsContainerRef}>
        {lyrics && lyrics.length > 0 ? (
          <div className="sidebar-lyrics-scroll-feed">
            {lyrics.map((line, idx) => {
              const isActive = idx === currentLyricIndex;
              const isPrev = idx === currentLyricIndex - 1;
              const isNext = idx === currentLyricIndex + 1;
              const isSeekable = typeof line.startTime === 'number' && !line.isIntro && !!onSeek;

              let lineClass = 'sidebar-lyric-faded';
              if (isActive) lineClass = 'sidebar-lyric-active';
              else if (isPrev || isNext) lineClass = 'sidebar-lyric-near';

              return (
                <div
                  key={`${line.startTime ?? idx}-${idx}`}
                  ref={isActive ? activeLyricRef : null}
                  className={`sidebar-lyric-line ${lineClass} ${isSeekable ? 'is-seekable' : ''}`}
                  onClick={() => {
                    if (isSeekable) onSeek(line.startTime);
                  }}
                  title={isSeekable ? `Jump to ${formatTime(line.startTime)}` : line.text}
                >
                  {line.isIntro ? (
                    <div className="sidebar-musical-interlude">
                      <Music size={13} />
                      <div className="sidebar-soundwave-mini">
                        <span className="sw-bar b1" />
                        <span className="sw-bar b2" />
                        <span className="sw-bar b3" />
                      </div>
                    </div>
                  ) : (
                    <span>{line.text}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="sidebar-instrumental-card">
            <div className="sidebar-inst-badge">
              <Sparkles size={12} />
              <span>{currentTrack?.title ? 'Synced Lyrics Unavailable • Pure Audio' : 'Waiting for music...'}</span>
            </div>
            <div className={`sidebar-ambient-eq ${isPlaying ? 'playing' : ''}`}>
              {[20, 35, 60, 90, 75, 45, 80, 100, 65, 30, 50, 85, 95, 70, 40, 25].map((h, i) => (
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

      {/* 4. PROGRESS BAR & CONTROLS (Below Lyrics) */}
      <div className="sidebar-player-controls-card">
        {/* Seekbar Row */}
        <div className="sidebar-seekbar-row">
          <span className="sidebar-time-label">{formatTime(progress)}</span>
          <div
            className={`sidebar-seekbar-track ${isHoveringSeek ? 'hovered' : ''}`}
            onClick={handleProgressClick}
            onMouseEnter={() => setIsHoveringSeek(true)}
            onMouseLeave={() => setIsHoveringSeek(false)}
            onMouseMove={handleSeekMouseMove}
            style={{ cursor: currentTrack?.canSeek === false ? 'default' : 'pointer' }}
          >
            {isHoveringSeek && hoverTime !== null && (
              <div className="sidebar-seekbar-tooltip" style={{ left: `${hoverPercent}%` }}>
                {formatTime(hoverTime)}
              </div>
            )}

            <div className={`sidebar-wave-container ${isPlaying ? 'is-playing' : ''}`}>
              {WAVE_BARS.slice(0, 26).map((baseH, idx) => {
                const barPct = (idx / 25) * 100;
                const isPlayed = barPct <= progressPercent;
                const isHovered = isHoveringSeek && barPct <= hoverPercent;
                return (
                  <span
                    key={idx}
                    className={`sidebar-wave-bar ${isPlayed ? 'played' : 'unplayed'} ${isHovered ? 'hover' : ''}`}
                    style={{
                      '--wb-h': `${baseH}%`,
                      '--wb-delay': `${(idx % 6) * -0.14}s`,
                    }}
                  />
                );
              })}
            </div>

            <div className="sidebar-flat-fill" style={{ width: `${progressPercent}%` }} />
            <div className="sidebar-seek-thumb" style={{ left: `${progressPercent}%` }} />
          </div>
          <button
            type="button"
            className="sidebar-time-label time-toggle-btn"
            onClick={() => setShowRemaining(!showRemaining)}
            title={showRemaining ? 'Switch to duration' : 'Switch to remaining'}
          >
            {showRemaining ? `-${formatTime(remaining)}` : formatTime(duration)}
          </button>
        </div>

        {/* Buttons Row */}
        <div className="sidebar-buttons-row">
          <button
            type="button"
            className={`sidebar-btn-sub ${shuffleState ? 'active' : ''}`}
            onClick={() => onShuffle && onShuffle(!shuffleState)}
            title={shuffleState ? 'Disable Shuffle' : 'Enable Shuffle'}
            aria-label="Shuffle"
          >
            <Shuffle size={15} />
          </button>

          <button
            type="button"
            className="sidebar-btn-sub"
            onClick={() => onSkip && onSkip('previous')}
            title="Previous track"
            aria-label="Previous track"
          >
            <SkipBack size={18} />
          </button>

          <button
            type="button"
            className="sidebar-btn-play"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={17} fill="#09090b" color="#09090b" />
            ) : (
              <Play size={17} fill="#09090b" color="#09090b" />
            )}
          </button>

          <button
            type="button"
            className="sidebar-btn-sub"
            onClick={() => onSkip && onSkip('next')}
            title="Next track"
            aria-label="Next track"
          >
            <SkipForward size={18} />
          </button>

          <button
            type="button"
            className={`sidebar-btn-sub ${repeatState !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            title={`Repeat: ${repeatState}`}
            aria-label={`Repeat: ${repeatState}`}
          >
            {repeatState === 'track' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>

          {/* Volume Button with Popout Slider */}
          <div
            className="sidebar-volume-wrapper"
            onMouseEnter={() => setShowVolumePopup(true)}
            onMouseLeave={() => setShowVolumePopup(false)}
          >
            <button
              type="button"
              className="sidebar-btn-sub"
              onClick={() => dispatchVolume(localVolume === 0 ? 50 : 0, true)}
              onWheel={handleWheelVolume}
              title={`Volume: ${localVolume}% (Scroll to adjust)`}
              aria-label="Volume"
            >
              {localVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {showVolumePopup && (
              <div
                className="sidebar-volume-popover"
                onWheel={handleWheelVolume}
              >
                <div
                  className="sidebar-vol-track"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    dispatchVolume(pct * 100, true);
                  }}
                >
                  <div className="sidebar-vol-fill" style={{ width: `${localVolume}%` }} />
                </div>
                <span className="sidebar-vol-num">{localVolume}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. BOTTOM HOVER-EXPANDABLE "UP NEXT" QUEUE DRAWER */}
      <div
        className={`sidebar-queue-drawer ${isQueueHovered ? 'expanded' : ''}`}
        onMouseEnter={handleQueueMouseEnter}
        onMouseLeave={handleQueueMouseLeave}
      >
        {/* Collapsed Pill Indicator (Always visible at the base) */}
        <div className="sidebar-queue-tab-bar">
          <div className="sidebar-queue-tab-left">
            <ListMusic size={14} className="sidebar-queue-icon" />
            <span className="sidebar-queue-pill-label">
              {nextTrack ? (
                <>
                  <strong className="queue-up-next-tag">Up Next:</strong> {nextTrack.title || 'Next Track'}
                  {nextTrack.artist ? ` · ${nextTrack.artist}` : ''}
                </>
              ) : (
                'Up Next: Hover to view queue'
              )}
            </span>
          </div>
          <ChevronUp size={14} className={`sidebar-drawer-chevron ${isQueueHovered ? 'rotated' : ''}`} />
        </div>

        {/* Expanded Drawer Surface (Slides up seamlessly on hover) */}
        <div className="sidebar-queue-expanded-panel">
          <div className="sidebar-queue-header">
            <span className="queue-title-bold">Upcoming Tracks ({queueItems.length})</span>
            {!isAuthenticated && onLogin && (
              <button type="button" className="sidebar-queue-connect-btn" onClick={onLogin}>
                <LogIn size={11} />
                <span>Connect</span>
              </button>
            )}
          </div>

          <div className="sidebar-queue-list">
            {queueItems.length > 0 ? (
              queueItems.map((item, idx) => {
                const isCur = isTrackMatch(item, currentTrack);
                const itemUri = item.uri || (item.id ? (item.id.startsWith('spotify:') ? item.id : `spotify:track:${item.id}`) : null);
                let queueOffset = currentIndexInQueue >= 0 ? idx - currentIndexInQueue : idx + 1;

                return (
                  <div
                    key={item.id || item.uri || idx}
                    className={`sidebar-queue-row ${isCur ? 'active-playing' : ''}`}
                    onClick={() => onPlayTrack && onPlayTrack(itemUri, queueOffset, item, queue?.meta?.contextUri)}
                    title={`Play ${item.title} - ${item.artist}`}
                    role="button"
                    tabIndex={0}
                  >
                    <img
                      src={item.albumArt || '/default-album-art.png'}
                      alt=""
                      className="sidebar-queue-thumb"
                      onError={(e) => {
                        e.currentTarget.src = '/default-album-art.png';
                      }}
                    />
                    <div className="sidebar-queue-info">
                      <div className="sidebar-queue-row-title">{item.title || 'Unknown Title'}</div>
                      <div className="sidebar-queue-row-artist">{item.artist || 'Unknown Artist'}</div>
                    </div>
                    <span className="sidebar-queue-duration">
                      {formatDuration(item.duration_ms || item.duration)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="sidebar-queue-empty">
                <span>{isAuthenticated ? 'No upcoming tracks in queue' : 'Connect Spotify to see full queue'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

