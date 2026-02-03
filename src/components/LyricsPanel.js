import React from 'react';

const LyricsPanel = ({ lyrics, currentIndex, provider, volume = 50, onVolumeChange }) => {
  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="lyrics-panel">
        {typeof onVolumeChange === 'function' && (
          <div className="lyrics-toolbar">
            <div className="lyrics-volume">
              <label className="lyrics-volume-label">Volume</label>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
                className="lyrics-volume-slider"
              />
              <span className="lyrics-volume-value">{volume}%</span>
            </div>
          </div>
        )}
        <div className="lyrics-container">
          <div className="lyrics-line">No lyrics available</div>
          <p className="lyrics-hint">Lyrics may appear for supported tracks from Spotify or LRCLIB.</p>
        </div>
      </div>
    );
  }

  const visibleLyrics = [];
  const startIndex = Math.max(0, currentIndex - 1);
  const endIndex = Math.min(lyrics.length, currentIndex + 2);
  for (let i = startIndex; i < endIndex; i++) {
    const lyric = lyrics[i];
    let className = 'lyrics-line';
    if (i === currentIndex) className += ' current';
    else if (i < currentIndex) className += ' past';
    visibleLyrics.push(
      <div key={i} className={className}>
        {lyric.text}
      </div>
    );
  }

  return (
    <div className="lyrics-panel">
      {typeof onVolumeChange === 'function' && (
        <div className="lyrics-toolbar">
          {typeof onVolumeChange === 'function' && (
            <div className="lyrics-volume">
              <label className="lyrics-volume-label">Volume</label>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
                className="lyrics-volume-slider"
              />
              <span className="lyrics-volume-value">{volume}%</span>
            </div>
          )}
        </div>
      )}
      <div className="lyrics-container">{visibleLyrics}</div>
    </div>
  );
};

export default LyricsPanel;
