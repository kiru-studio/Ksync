import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2,
  Heart
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
          <button className="control-button">
            <Shuffle size={16} />
          </button>
          <button 
            className="control-button"
            onClick={() => onSkip('previous')}
          >
            <SkipBack size={16} />
          </button>
          <button 
            className="play-button"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button 
            className="control-button"
            onClick={() => onSkip('next')}
          >
            <SkipForward size={16} />
          </button>
          <button className="control-button">
            <Repeat size={16} />
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
              style={{ width: `${(progress / duration) * 100}%` }}
            />
          </div>
          <span className="time-display">{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="volume-control">
        <Volume2 size={16} color="#b3b3b3" />
        <div 
          className="volume-slider"
          onClick={handleVolumeClick}
        >
          <div 
            className="volume-fill"
            style={{ width: `${volume}%` }}
          />
        </div>
      </div>
      
      <button className="control-button">
        <Heart size={16} />
      </button>
    </div>
  );
};

export default NowPlaying;
