import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Monitor,
} from 'lucide-react';

const NowPlaying = ({
  track,
  isPlaying,
  progress,
  duration,
  volume,
  shuffleState,
  repeatState,
  devices,
  currentDeviceId,
  onPlayPause,
  onSkip,
  onVolumeChange,
  onProgressChange,
  onShuffle,
  onRepeat,
  onDeviceChange,
}) => {
  const [showDevices, setShowDevices] = useState(false);

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newProgress = percentage * duration;
    onProgressChange(newProgress);
  };

  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newVolume = Math.round(percentage * 100);
    onVolumeChange(newVolume);
  };

  const progressPercent = duration ? Math.max(0, Math.min(100, (progress / duration) * 100)) : 0;
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
    <div className="now-playing">
      <div className="album-art-container">
        <img
          src={track?.albumArt || '/default-album-art.png'}
          alt="Album Art"
          className="album-art"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250"><rect fill="%23333" width="250" height="250"/><text x="50%" y="50%" fill="%23888" font-size="14" text-anchor="middle" dy=".3em">No art</text></svg>';
          }}
        />
      </div>

      <div className="song-info">
        <div className="song-title">
          {track?.title || (deviceList.length > 0 ? 'Play something in Spotify (same account) to see it here' : 'No track playing')}
        </div>
        <div className="song-artist">{track?.artist || (deviceList.length > 0 ? 'Dock and Spotify app must use the same account' : 'Unknown Artist')}</div>

        <div className="controls">
          <button
            type="button"
            className={`control-button shuffle ${shuffleState ? 'active' : ''}`}
            aria-label="Shuffle"
            onClick={() => onShuffle && onShuffle(!shuffleState)}
          >
            <Shuffle />
          </button>
          <button type="button" className="control-button prev" aria-label="Previous" onClick={() => onSkip('previous')}>
            <SkipBack />
          </button>
          <button type="button" className="play-button" aria-label="Play/Pause" onClick={onPlayPause}>
            {isPlaying ? <Pause /> : <Play />}
          </button>
          <button type="button" className="control-button next" aria-label="Next" onClick={() => onSkip('next')}>
            <SkipForward />
          </button>
          <button
            type="button"
            className={`control-button repeat ${repeatState !== 'off' ? 'active' : ''}`}
            aria-label="Repeat"
            onClick={cycleRepeat}
          >
            {repeatState === 'track' ? <Repeat1 /> : <Repeat />}
          </button>
        </div>

        <div className="progress-container">
          <span className="time-display">{formatTime(progress)}</span>
          <div className="progress-bar" onClick={handleProgressClick}>
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            <div className="progress-knob" style={{ left: `${progressPercent}%` }} />
          </div>
          <span className="time-display time-remaining">-{formatTime(remaining)}</span>
        </div>

        {deviceList.length > 0 && (
          <div className="device-selector">
            <button
              type="button"
              className="device-trigger"
              onClick={() => setShowDevices(!showDevices)}
              aria-label="Select device"
            >
              <Monitor size={16} />
              <span>{currentDevice?.name || 'Device'}</span>
            </button>
            {showDevices && (
              <ul className="device-list">
                {deviceList.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={d.id === currentDeviceId ? 'active' : ''}
                      onClick={() => {
                        onDeviceChange && onDeviceChange(d.id);
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
  );
};

export default NowPlaying;
