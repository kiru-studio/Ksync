import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat
} from 'lucide-react';

const NowPlaying = ({ 
  track, 
  isPlaying, 
  progress, 
  duration, 
  volume, 
  onPlayPause, 
  onSkip, 
  onVolumeChange, 
  onProgressChange 
}) => {
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

  return (
    <div className="now-playing">
      <div className="album-art-container">
        <img
          src={track?.albumArt || '/default-album-art.png'}
          alt="Album Art"
          className="album-art"
          onError={(e) => {
            e.target.src = '/default-album-art.png';
          }}
        />
      </div>
      
      <div className="song-info">
        <div className="song-title">
          {track?.title || 'No track playing'}
        </div>
        <div className="song-artist">
          {track?.artist || 'Unknown Artist'}
        </div>
        
        <div className="controls">
          <button className="control-button shuffle" aria-label="Shuffle">
            <Shuffle />
          </button>
          <button 
            className="control-button prev" aria-label="Previous"
            onClick={() => onSkip('previous')}
          >
            <SkipBack />
          </button>
          <button 
            className="play-button" aria-label="Play/Pause"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause /> : <Play />}
          </button>
          <button 
            className="control-button next" aria-label="Next"
            onClick={() => onSkip('next')}
          >
            <SkipForward />
          </button>
          <button className="control-button repeat" aria-label="Repeat">
            <Repeat />
          </button>
        </div>
        
        <div className="progress-container">
          <span className="time-display">{formatTime(progress)}</span>
          <div 
            className="progress-bar"
            onClick={handleProgressClick}
          >
            <div 
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="progress-knob"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <span className="time-display time-remaining">-{formatTime(remaining)}</span>
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;
