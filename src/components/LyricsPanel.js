import React from 'react';

const LyricsPanel = ({ lyrics, currentIndex }) => {
  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="lyrics-panel">
        <div className="lyrics-container">
          <div className="lyrics-line">
            No lyrics available
          </div>
        </div>
      </div>
    );
  }

  const renderLyrics = () => {
    const visibleLyrics = [];
    const startIndex = Math.max(0, currentIndex - 1);
    const endIndex = Math.min(lyrics.length, currentIndex + 2);

    for (let i = startIndex; i < endIndex; i++) {
      const lyric = lyrics[i];
      let className = 'lyrics-line';
      
      if (i === currentIndex) {
        className += ' current';
      } else if (i < currentIndex) {
        className += ' past';
      }

      visibleLyrics.push(
        <div key={i} className={className}>
          {lyric.text}
        </div>
      );
    }

    return visibleLyrics;
  };

  return (
    <div className="lyrics-panel">
      <div className="lyrics-container">
        {renderLyrics()}
      </div>
    </div>
  );
};

export default LyricsPanel;
