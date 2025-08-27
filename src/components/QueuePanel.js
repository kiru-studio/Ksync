import React from 'react';

const QueuePanel = ({ queue }) => {
  const items = Array.isArray(queue?.items) ? queue.items : (Array.isArray(queue) ? queue : []);
  const meta = queue && !Array.isArray(queue) ? queue : {};

  if (!items || items.length === 0) {
    return (
      <div className="queue-panel">
        <div className="queue-header">Next from: {meta.source ? meta.source : 'Queue'}</div>
        <div className="queue-item">
          <div className="queue-info">
            <div className="queue-title">No upcoming tracks</div>
            <div className="queue-artist">Queue is empty</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="queue-panel">
      <div className="queue-header">
        Next from: {items[0]?.playlistName || meta.context || 'Queue'}
      </div>
      {items.slice(0, 3).map((track, index) => (
        <div key={index} className="queue-item">
          <img
            src={track.albumArt || '/default-album-art.png'}
            alt="Album Art"
            className="queue-art"
            onError={(e) => {
              e.target.src = '/default-album-art.png';
            }}
          />
          <div className="queue-info">
            <div className="queue-title">{track.title}</div>
            <div className="queue-artist">{track.artist}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QueuePanel;
