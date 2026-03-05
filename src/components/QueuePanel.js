import React from 'react';

const QueuePanel = ({ queue, onPlayTrack }) => {
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

  const displayItems = (items || []).slice(0, 3);
  return (
    <div className="queue-panel">
      <div className="queue-header">
        Next from: {displayItems[0]?.playlistName || meta.source || meta.context || 'Queue'}
      </div>
      <div className="queue-list">
        {displayItems.map((track, index) => (
          <div
            key={track.id || index}
            className="queue-item"
            role="button"
            tabIndex={0}
            onClick={() => track.uri && onPlayTrack && onPlayTrack(track.uri)}
            onKeyDown={(e) => e.key === 'Enter' && track.uri && onPlayTrack && onPlayTrack(track.uri)}
          >
            <img
              src={track.albumArt || '/default-album-art.png'}
              alt=""
              className="queue-art"
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23333" width="64" height="64"/></svg>';
              }}
            />
            <div className="queue-info">
              <div className="queue-title">{track.title}</div>
              <div className="queue-artist">{track.artist}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueuePanel;
