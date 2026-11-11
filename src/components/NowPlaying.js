import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Monitor,
  Heart,
} from 'lucide-react';
import MarqueeText from './MarqueeText';
import SpotifyService from '../services/SpotifyService';
import CircularAudioVisualizer from './CircularAudioVisualizer';

const FALLBACK_ARTWORK = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80';

const WAVE_BARS = [
  30, 42, 60, 80, 50, 38, 70, 95, 82, 58, 44, 76, 92, 100, 72, 48, 64, 88, 96,
  78, 54, 40, 62, 82, 92, 74, 52, 66, 84, 98, 68, 46, 58, 48, 36, 26,
];

const NowPlaying = ({
  track,
  isPlaying,
  progress = 0,
  duration = 0,
  volume = 50,
  systemVolume = 50,
  systemMuted = false,
  shuffleState = false,
  repeatState = 'off',
  devices = [],
  currentDeviceId,
  onPlayPause,
  onSkip,
  onVolumeChange,
  onSystemVolumeChange,
  onSystemMuteToggle,
  onProgressChange,
  onShuffle,
  onRepeat,
  onDeviceChange,
}) => {
  const [showDevices, setShowDevices] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  // Synchronize Like/Heart status with Spotify library and persistent cache
  useEffect(() => {
    if (!track || !track.title) {
      setIsLiked(false);
      return;
    }

    const trackKey = `${(track.title || '').toLowerCase().trim()}:::${(track.artist || '').toLowerCase().trim()}`;
    try {
      const local = JSON.parse(localStorage.getItem('ksync_liked_tracks') || '{}');
      if (typeof local[trackKey] === 'boolean') {
        setIsLiked(local[trackKey]);
      }
    } catch (_) {}

    SpotifyService.checkSavedTracks({
      trackId: track.id,
      title: track.title,
      artist: track.artist,
    }).then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        const liked = !!res[0];
        setIsLiked(liked);
        try {
          const local = JSON.parse(localStorage.getItem('ksync_liked_tracks') || '{}');
          local[trackKey] = liked;
          localStorage.setItem('ksync_liked_tracks', JSON.stringify(local));
        } catch (_) {}
      }
    }).catch(() => {});
  }, [track?.id, track?.title, track?.artist]);

  const handleToggleLike = async (e) => {
    e.stopPropagation();
    if (!track || !track.title) return;

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);

    const trackKey = `${(track.title || '').toLowerCase().trim()}:::${(track.artist || '').toLowerCase().trim()}`;
    try {
      const local = JSON.parse(localStorage.getItem('ksync_liked_tracks') || '{}');
      local[trackKey] = nextLiked;
      localStorage.setItem('ksync_liked_tracks', JSON.stringify(local));
    } catch (_) {}

    const payload = {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
    };

    try {
      if (nextLiked) {
        await SpotifyService.saveTrack(payload);
      } else {
        await SpotifyService.removeTrack(payload);
      }
    } catch (err) {
      console.warn('[NowPlaying] toggle like error:', err);
    }
  };

  // Artwork Crossfade & Morphing
  const [currentArt, setCurrentArt] = useState(track?.albumArt || FALLBACK_ARTWORK);
  const [prevArt, setPrevArt] = useState(null);
  const [isCrossfading, setIsCrossfading] = useState(false);

  useEffect(() => {
    const nextArt = track?.albumArt || FALLBACK_ARTWORK;
    if (nextArt !== currentArt) {
      setPrevArt(currentArt);
      setCurrentArt(nextArt);
      setIsCrossfading(true);
      const timer = setTimeout(() => {
        setIsCrossfading(false);
        setPrevArt(null);
      }, 320);
      return () => clearTimeout(timer);
    }
  }, [track?.albumArt]);
  
  // Circle rotating artwork state (toggle via click, sync with localStorage)
  const [isCircleArt, setIsCircleArt] = useState(() => {
    try {
      return localStorage.getItem('ksync_circle_art') === 'true';
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ksync_circle_art') {
        setIsCircleArt(e.newValue === 'true');
      }
    };
    const handleCustomToggle = (e) => {
      if (e.detail && typeof e.detail.isCircle === 'boolean') {
        setIsCircleArt(e.detail.isCircle);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('ksync:circle-art-toggle', handleCustomToggle);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ksync:circle-art-toggle', handleCustomToggle);
    };
  }, []);

  const toggleCircleArt = () => {
    const next = !isCircleArt;
    setIsCircleArt(next);
    try {
      localStorage.setItem('ksync_circle_art', String(next));
      window.dispatchEvent(new CustomEvent('ksync:circle-art-toggle', { detail: { isCircle: next } }));
    } catch (_) {}
  };

  // Right-hand time toggle (elapsed vs remaining) with persistence
  const [showRemaining, setShowRemaining] = useState(() => {
    try {
      return localStorage.getItem('ksync_show_remaining') === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggleRemaining = () => {
    const next = !showRemaining;
    setShowRemaining(next);
    try {
      localStorage.setItem('ksync_show_remaining', String(next));
    } catch (_) {}
  };

  // Progress hover state & tooltip
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPercent, setHoverPercent] = useState(0);
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);

  // Dynamic Song BPM tracking for audio visualizer pulse
  const [trackBpm, setTrackBpm] = useState(120);
  useEffect(() => {
    if (!track) {
      setTrackBpm(120);
      return;
    }
    let isMounted = true;
    if (typeof track.tempo === 'number' && track.tempo > 40) {
      setTrackBpm(Math.round(track.tempo));
      return;
    }
    if (typeof track.bpm === 'number' && track.bpm > 40) {
      setTrackBpm(Math.round(track.bpm));
      return;
    }
    SpotifyService.getAudioFeatures({
      trackId: track.id,
      title: track.title,
      artist: track.artist,
    }).then((features) => {
      if (isMounted && features && typeof features.tempo === 'number' && features.tempo > 40) {
        setTrackBpm(Math.round(features.tempo));
      }
    }).catch(() => {});

    let hash = 0;
    const str = `${track.title || ''} ${track.artist || ''}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    setTrackBpm(95 + (Math.abs(hash) % 45));
    return () => { isMounted = false; };
  }, [track?.id, track?.title, track?.artist]);

  // Synchronized reset on track change (disabling backward sweep transition)
  const lastTrackIdRef = useRef(track?.id || track?.title);
  const [skipTransition, setSkipTransition] = useState(false);

  useEffect(() => {
    const currentId = track?.id || track?.title;
    if (currentId && currentId !== lastTrackIdRef.current) {
      lastTrackIdRef.current = currentId;
      setSkipTransition(true);
      const timer = setTimeout(() => setSkipTransition(false), 50);
      return () => clearTimeout(timer);
    }
  }, [track?.id, track?.title]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    if (track?.canSeek === false || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    const newProgress = percentage * duration;
    if (onProgressChange) onProgressChange(newProgress);
  };

  const handleSeekMouseMove = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = (clickX / rect.width) * 100;
    setHoverPercent(pct);
    setHoverTime((clickX / rect.width) * duration);
  };


  const seekTrackRef = useRef(null);
  const [isSeekDragging, setIsSeekDragging] = useState(false);

  const handleSeekPointerDown = (e) => {
    if (track?.canSeek === false || !duration || !onProgressChange) return;
    e.stopPropagation();
    e.preventDefault();
    setIsSeekDragging(true);

    const calcSeek = (clientX) => {
      if (!seekTrackRef.current) return progress;
      const rect = seekTrackRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = (clickX / rect.width) * 100;
      setHoverPercent(pct);
      setHoverTime((clickX / rect.width) * duration);
      return (clickX / rect.width) * duration;
    };

    onProgressChange(calcSeek(e.clientX));

    const onPointerMove = (me) => {
      onProgressChange(calcSeek(me.clientX));
    };
    const onPointerUp = () => {
      setIsSeekDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const progressPercent = duration > 0 ? Math.max(0, Math.min(100, (progress / duration) * 100)) : 0;
  const remaining = Math.max(0, (duration || 0) - (progress || 0));

  const cycleRepeat = () => {
    if (!onRepeat) return;
    if (repeatState === 'off') onRepeat('context');
    else if (repeatState === 'context') onRepeat('track');
    else onRepeat('off');
  };

  const deviceList = Array.isArray(devices) ? devices : [];
  const currentDevice = deviceList.find((d) => d.id === currentDeviceId) || deviceList[0];

  return (
    <div className="now-playing-compact">
      <div
        className={`art-wrapper ${isCircleArt ? 'circle-rotating-art' : ''} ${isPlaying ? 'is-playing' : 'is-paused'}`}
        onClick={toggleCircleArt}
        role="button"
        tabIndex={0}
        title={isCircleArt ? "Click to switch to standard album art" : "Click to switch to rotating circular vinyl art"}
      >
        {/* Dynamic Circular Audio Spectrum Visualizer (on rotating circular vinyl) */}
        {isCircleArt && (
          <CircularAudioVisualizer
            isPlaying={isPlaying}
            progress={progress}
            bpm={trackBpm}
            discRadius={48}
            size={180}
          />
        )}
        {/* Propagating Harmonic Wave Ripples */}
        {isCircleArt ? (
          <div className={`compact-circle-waves ${isPlaying ? 'is-playing' : 'is-paused'}`} aria-hidden="true">
            <div className="compact-wave-ripple ripple-1" />
            <div className="compact-wave-ripple ripple-2" />
          </div>
        ) : (
          <div className={`compact-square-waves ${isPlaying ? 'is-playing' : 'is-paused'}`} aria-hidden="true">
            <div className="compact-square-ripple ripple-1" />
            <div className="compact-square-ripple ripple-2" />
          </div>
        )}
        <div className="art-ambient-tint" />
        <div className="art-disc-inner">
          {prevArt && (
            <img
              src={prevArt}
              alt="Previous Album Art"
              className="art-img art-img-prev"
            />
          )}
          <img
            src={currentArt}
            alt="Album Art"
            className={`art-img art-img-current ${isCrossfading ? 'art-crossfade-in' : ''}`}
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23282828" width="64" height="64" rx="8"/><circle cx="32" cy="32" r="16" fill="%231db954" opacity="0.4"/></svg>';
            }}
          />
        </div>
        {isCircleArt && (
          <div className="art-vinyl-spindle">
            <div className="art-vinyl-spindle-dot" />
          </div>
        )}
      </div>

      <div className="track-meta">
        <div className="meta-header">
          <div className="track-text">
            <MarqueeText
              text={track?.title || 'No track playing'}
              className="track-title"
              speed={32}
              gap={36}
            />
            <MarqueeText
              text={track?.artist || 'Open Spotify to listen'}
              className="track-artist"
              speed={26}
              gap={30}
            />
          </div>

          <div className="quick-actions">
            {/* Heart / Like Button */}
            <button
              type="button"
              className={`icon-mini-btn ${isLiked ? 'active-like' : ''}`}
              onClick={handleToggleLike}
              title={isLiked ? "Remove from Your Library" : "Save to Your Library"}
              aria-label={isLiked ? "Unlike" : "Like"}
            >
              <Heart 
                size={16} 
                fill={isLiked ? "var(--accent)" : "none"} 
                color={isLiked ? "var(--accent)" : "currentColor"} 
              />
            </button>

            {/* Device Picker */}
            {deviceList.length > 0 && (
              <div className="device-menu-wrap">
                <button
                  type="button"
                  className="icon-mini-btn"
                  onClick={() => setShowDevices(!showDevices)}
                  title={currentDevice ? `Playing on ${currentDevice.name}` : 'Select device'}
                  aria-label="Devices"
                >
                  <Monitor size={16} />
                </button>
                {showDevices && (
                  <ul className="device-dropdown">
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
          </div>
        </div>

        {/* Player Controls Row matching seekbar width */}
        <div className="controls-row">
          <button
            type="button"
            className={`btn-ctrl-sub ${shuffleState ? 'active' : ''}`}
            aria-label="Shuffle"
            onClick={() => onShuffle && onShuffle(!shuffleState)}
            title={shuffleState ? "Disable Shuffle" : "Enable Shuffle"}
          >
            <Shuffle size={17} />
          </button>
          
          <button
            type="button"
            className="btn-ctrl-sub"
            aria-label="Previous track"
            onClick={() => onSkip && onSkip('previous')}
            title="Previous track"
          >
            <SkipBack size={19} />
          </button>
          
          <button
            type="button"
            className="btn-play-pause"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} fill="#09090B" color="#09090B" />
            ) : (
              <Play size={18} fill="#09090B" color="#09090B" />
            )}
          </button>
          
          <button
            type="button"
            className="btn-ctrl-sub"
            aria-label="Next track"
            onClick={() => onSkip && onSkip('next')}
            title="Next track"
          >
            <SkipForward size={19} />
          </button>
          
          <button
            type="button"
            className={`btn-ctrl-sub ${repeatState !== 'off' ? 'active' : ''}`}
            aria-label={`Repeat: ${repeatState}`}
            onClick={cycleRepeat}
            title={`Repeat: ${repeatState}`}
          >
            {repeatState === 'track' ? <Repeat1 size={17} /> : <Repeat size={17} />}
          </button>
        </div>

        {/* Dynamic Audio Wave Progress Bar */}
        <div className="seekbar-row flex items-center gap-2.5 w-full select-none">
          <span className="time-lbl shrink-0 font-mono text-[11px] tabular-nums text-white/50 w-8 text-left select-none">
            {formatTime(progress)}
          </span>
          <div
            ref={seekTrackRef}
            className={`seekbar-track wave-seekbar-track relative flex-1 h-[14px] bg-transparent cursor-pointer select-none flex items-center group/seek ${(isHoveringSeek || isSeekDragging) ? 'hovered' : ''}`}
            onPointerDown={handleSeekPointerDown}
            onMouseEnter={() => setIsHoveringSeek(true)}
            onMouseLeave={() => setIsHoveringSeek(false)}
            onMouseMove={handleSeekMouseMove}
            style={{ cursor: track?.canSeek === false ? 'default' : 'pointer' }}
          >
            {(isHoveringSeek || isSeekDragging) && hoverTime !== null && (
              <div 
                className="seekbar-hover-tooltip absolute -top-7 -translate-x-1/2 bg-[rgba(10,12,18,0.95)] text-white font-mono text-[10.5px] px-2 py-0.5 rounded-md border border-white/20 pointer-events-none z-30 shadow-xl" 
                style={{ left: `${hoverPercent}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
            
            {/* Dynamic Animated Wave Bars */}
            <div className={`wave-bars-container ${isPlaying ? 'is-playing' : 'is-paused'}`}>
              {WAVE_BARS.map((baseHeight, idx) => {
                const barPct = (idx / (WAVE_BARS.length - 1)) * 100;
                const isPlayed = barPct <= progressPercent;
                const isHovered = (isHoveringSeek || isSeekDragging) && barPct <= hoverPercent;

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

            {/* Flat Solid Progress Bar on Pause */}
            <div className={`flat-progress-container ${!isPlaying ? 'active' : ''}`}>
              <div
                className={`flat-progress-fill ${skipTransition ? 'no-transition' : ''}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Draggable Circular White Thumb Knob on Hover */}
            <div 
              className={`seekbar-thumb wave-thumb absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9),0_0_10px_var(--accent,#1db954)] transition-opacity duration-150 pointer-events-none z-10 ${(isHoveringSeek || isSeekDragging) ? 'opacity-100 scale-110' : 'opacity-0'}`} 
              style={{ left: `${progressPercent}%` }} 
            />
          </div>
          <button
            type="button"
            className="time-lbl time-lbl-btn shrink-0 font-mono text-[11px] tabular-nums text-white/50 hover:text-white transition-colors cursor-pointer border-none bg-transparent p-0 w-9 text-right select-none"
            onClick={toggleRemaining}
            title={showRemaining ? "Switch to total duration" : "Switch to remaining time"}
          >
            {showRemaining ? `-${formatTime(remaining)}` : formatTime(duration)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;
