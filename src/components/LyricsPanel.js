import React from 'react';

const LyricsPanel = ({ lyrics, currentIndex, provider, lyricsOffsetMs = 0, onOffsetChange }) => {
  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="lyrics-panel">
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
      {(provider || onOffsetChange) && (
        <div className="lyrics-toolbar">
          {provider && <span className="lyrics-provider">Source: {provider}</span>}
          {typeof onOffsetChange === 'function' && (
            <div className="lyrics-offset">
              <label className="lyrics-offset-label">Sync offset (s):</label>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.5"
                value={lyricsOffsetMs / 1000}
                onChange={(e) => onOffsetChange(parseFloat(e.target.value) * 1000)}
                className="lyrics-offset-slider"
              />
              <span className="lyrics-offset-value">{lyricsOffsetMs / 1000}s</span>
            </div>
          )}
        </div>
      )}
      <div className="lyrics-container">{visibleLyrics}</div>
    </div>
  );
};

export default LyricsPanel;
