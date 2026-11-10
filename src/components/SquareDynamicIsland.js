import React from 'react';
import AudioPlayer from './ui/audio-player';

const FALLBACK_ARTWORK = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80';

export default function SquareDynamicIsland({
  currentTrack,
  isPlaying,
  progress = 0,
  duration = 0,
  volume = 50,
  systemVolume = 50,
  systemMuted = false,
  islandShape = 'square',
  shuffleState,
  repeatState,
  lyrics = [],
  currentLyricIndex = -1,
  queue = [],
  onPlayPause,
  onSkip,
  onSeek,
  onShuffle,
  onRepeat,
  onPlayTrack,
  onVolumeChange,
  onSystemVolumeChange,
  onSystemMuteToggle,
  onOpenSettings,
}) {
  const albumArt = currentTrack?.albumArt || FALLBACK_ARTWORK;
  const queueItems = Array.isArray(queue) ? queue : queue?.items || [];

  return (
    <div className="square-dynamic-island-root relative w-full h-full max-h-[220px] flex items-center justify-center select-none">
      <AudioPlayer
        artworkUrl={albumArt}
        title={currentTrack?.title || 'No Track Playing'}
        subtitle={currentTrack?.artist || (currentTrack?.album ? `${currentTrack.album}` : 'Spotify / SMTC')}
        currentTime={progress || 0}
        duration={duration || 180}
        isPlaying={isPlaying}
        volume={volume}
        systemVolume={systemVolume}
        systemMuted={systemMuted}
        islandShape={islandShape}
        shuffleState={shuffleState}
        repeatState={repeatState}
        lyrics={lyrics}
        currentLyricIndex={currentLyricIndex}
        queue={queueItems}
        onChange={(sec) => onSeek && onSeek(sec)}
        onToggle={onPlayPause}
        onPrevious={() => onSkip && onSkip('previous')}
        onNext={() => onSkip && onSkip('next')}
        onShuffle={onShuffle}
        onRepeat={onRepeat}
        onPlayTrack={onPlayTrack}
        onVolumeChange={onVolumeChange}
        onSystemVolumeChange={onSystemVolumeChange}
        onSystemMuteToggle={onSystemMuteToggle}
        onOutput={onOpenSettings}
        className="w-full h-full"
      />
    </div>
  );
}
