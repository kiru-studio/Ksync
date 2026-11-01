import React, { useRef, useEffect, useState } from 'react';
import { ListMusic, Play, LogIn } from 'lucide-react';
import MarqueeText from './MarqueeText';

function formatDuration(msOrSec) {
  if (!msOrSec) return '';
  const totalSec = msOrSec > 1000 ? Math.floor(msOrSec / 1000) : Math.floor(msOrSec);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatHeaderTitle(rawSource) {
  if (!rawSource) return 'Up Next';
  const isPlaylist = /^playlist:\s*/i.test(rawSource);
  const isAlbum = /^album:\s*/i.test(rawSource);
  const clean = rawSource.replace(/^(playlist:\s*|album:\s*)/i, '').trim();
  
  if (isPlaylist) return `Playlist · ${clean}`;
  if (isAlbum) return `Album · ${clean}`;
  return clean || 'Up Next';
}

function formatArtists(artistString) {
  if (!artistString) return 'Unknown Artist';
  const parts = artistString.split(',').map((s) => s.trim());
  if (parts.length > 2) {
    return `${parts.slice(0, 2).join(', ')} +${parts.length - 2}`;
  }
  return artistString;
}

function cleanStringForMatch(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*[\(\[](feat|ft|with|from|remaster|mix|version|deluxe|bonus|radio|edit|live|mono|stereo|anniversary).*?[\)\]]/gi, '')
    .replace(/\s*-\s*(from|remaster|mix|version|radio|edit|live|mono|stereo|bonus|deluxe).*$/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

function isTrackMatch(track, currentTrack) {
  if (!track || !currentTrack) return false;
  // 1. Direct ID match if both have valid Spotify IDs
  if (track.id && currentTrack.id && !track.id.startsWith('smtc-') && !currentTrack.id.startsWith('smtc-')) {
    if (track.id === currentTrack.id) return true;
  }
  // 2. Direct URI match
  if (track.uri && currentTrack.uri && track.uri === currentTrack.uri) return true;

  // 3. Clean title match
  const tTitle = cleanStringForMatch(track.title || track.name);
  const cTitle = cleanStringForMatch(currentTrack.title || currentTrack.name);
  if (!tTitle || !cTitle || tTitle !== cTitle) return false;

  // 4. Verify artists if both exist
  const tArtist = cleanStringForMatch(track.artist || (track.artists ? track.artists.map((a) => a.name).join(' ') : ''));
  const cArtist = cleanStringForMatch(currentTrack.artist);
  if (tArtist && cArtist) {
    if (tArtist.includes(cArtist) || cArtist.includes(tArtist)) return true;
    return tTitle.length >= 4;
  }
  return true;
}

const QueuePanel = ({
  queue,
  currentTrack,
  isPlaying = false,
  onPlayTrack,
  isAuthenticated,
  user,
  onLogin,
  onLogout,
}) => {
  const items = Array.isArray(queue?.items) ? queue.items : (Array.isArray(queue) ? queue : []);
  const meta = queue && !Array.isArray(queue) ? queue : {};
  const rawSource = meta.source || (items.length > 0 ? 'Up Next' : 'Queue');
  const headerTitle = formatHeaderTitle(rawSource);

  // Display all tracks in the scrollable queue area
  const displayItems = items;

  // Auto-scroll to now playing row (Item 29)
  const nowPlayingRowRef = useRef(null);
  const containerRef = useRef(null);
  const [isUserHovering, setIsUserHovering] = useState(false);

  useEffect(() => {
    if (!isUserHovering && nowPlayingRowRef.current) {
      nowPlayingRowRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [currentTrack?.id, currentTrack?.title, isUserHovering]);

  const handleCardKeyDown = (e, idx, trackUri, queueOffset, track) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onPlayTrack) onPlayTrack(trackUri, queueOffset, track, meta.contextUri);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextCard = containerRef.current?.children[idx + 1];
      if (nextCard && typeof nextCard.focus === 'function') {
        nextCard.focus();
        nextCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevCard = containerRef.current?.children[idx - 1];
      if (prevCard && typeof prevCard.focus === 'function') {
        prevCard.focus();
        prevCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      const firstCard = containerRef.current?.children[0];
      if (firstCard && typeof firstCard.focus === 'function') {
        firstCard.focus();
        firstCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      const lastCard = containerRef.current?.children[displayItems.length - 1];
      if (lastCard && typeof lastCard.focus === 'function') {
        lastCard.focus();
        lastCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  };

  const currentIndex = displayItems.findIndex((t) => isTrackMatch(t, currentTrack));

  return (
    <div 
      className="queue-panel-compact"
      onMouseEnter={() => setIsUserHovering(true)}
      onMouseLeave={() => setIsUserHovering(false)}
    >
      {/* Header Bar with Inlined Count and Separated Profile / Close Buttons */}
      <div className="queue-header-bar">
        <div className="queue-header-info">
          <div className="queue-title-badge" title={rawSource}>
            <ListMusic size={13} className="queue-badge-icon" />
            <span className="queue-title-text">
              {headerTitle} {displayItems.length > 0 && <span className="queue-inline-count">· {displayItems.length}</span>}
            </span>
          </div>
        </div>

        <div className="queue-user-area">
          {isAuthenticated ? (
            <>
              <div 
                className="user-pill-clean" 
                title={`Logged in as ${user?.display_name || 'Spotify User'}`}
              >
                {user?.images?.[0]?.url ? (
                  <img src={user.images[0].url} alt="" className="user-mini-avatar" />
                ) : (
                  <span className="user-default-icon">👤</span>
                )}
                <span className="user-mini-name">{user?.display_name?.split(' ')[0] || 'User'}</span>
              </div>
              <button 
                type="button" 
                className="dock-hide-circle-btn" 
                onClick={() => {
                  if (typeof window !== 'undefined' && window.electronAPI?.scrollHide) {
                    window.electronAPI.scrollHide();
                  }
                }} 
                title="Hide Dock"
                aria-label="Hide Dock"
              >
                ×
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="connect-mini-pill"
                onClick={onLogin}
                title="Connect Spotify for live Up Next queue & history"
                aria-label="Connect Spotify"
              >
                <LogIn size={12} />
                <span>Connect</span>
              </button>
              <button 
                type="button" 
                className="dock-hide-circle-btn" 
                onClick={() => {
                  if (typeof window !== 'undefined' && window.electronAPI?.scrollHide) {
                    window.electronAPI.scrollHide();
                  }
                }} 
                title="Hide Dock"
                aria-label="Hide Dock"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cards Area with Smooth Scroll, Now-Playing Highlight, and Equalizer */}
      <div 
        className="queue-cards-area" 
        ref={containerRef}
        onWheel={(e) => e.stopPropagation()}
      >
        {displayItems.length > 0 ? (
          displayItems.map((track, idx) => {
            const trackTitle = track.title || 'Unknown Title';
            const trackArtist = track.artist || 'Unknown Artist';
            const isCurrent = isTrackMatch(track, currentTrack);
            
            const durationFormatted = formatDuration(track.duration_ms || track.duration);

            const trackUri = track.uri || (track.id ? (track.id.startsWith('spotify:') ? track.id : `spotify:track:${track.id}`) : null);

            let queueOffset = null;
            if (currentIndex !== -1) {
              queueOffset = idx - currentIndex;
            } else {
              queueOffset = idx + 1;
            }

            return (
              <div
                key={track.id || track.uri || idx}
                ref={isCurrent ? nowPlayingRowRef : null}
                className={`queue-card ${isCurrent ? 'now-playing-row' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onPlayTrack && onPlayTrack(trackUri, queueOffset, track, meta.contextUri)}
                onKeyDown={(e) => handleCardKeyDown(e, idx, trackUri, queueOffset, track)}
                title={`Play: ${trackTitle} - ${trackArtist}`}
              >
                {/* Thumbnail with Equalizer & Play Hover (Items 30 & 35) */}
                <div className="queue-card-art">
                  <img
                    src={track.albumArt || '/default-album-art.png'}
                    alt=""
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect fill="%23222" width="32" height="32" rx="6"/></svg>';
                    }}
                  />

                  {/* Equalizer overlay on currently playing thumbnail (Item 30) */}
                  {isCurrent ? (
                    <div className={`queue-playing-eq ${!isPlaying ? 'paused' : ''}`}>
                      <span className="eq-bar eq-1" />
                      <span className="eq-bar eq-2" />
                      <span className="eq-bar eq-3" />
                    </div>
                  ) : (
                    /* Play icon hover scrim (Item 35) */
                    <div className="queue-card-play-overlay">
                      <Play size={11} fill="#fff" />
                    </div>
                  )}
                </div>

                {/* Song Title (Semi-bold) & Artist (Dimmer #b3b3b3) (Items 37 & 38) */}
                <div className="queue-card-text">
                  <MarqueeText text={trackTitle} className="queue-card-title" speed={26} gap={28} />
                  <span className="queue-card-artist" title={track.artist || ''}>
                    {formatArtists(trackArtist)}
                  </span>
                </div>

                {/* Duration on the right (Item 34) */}
                {durationFormatted && (
                  <div className="queue-card-duration">
                    {durationFormatted}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="queue-placeholder">
            {isAuthenticated ? (
              <span>Queue is empty. Queue tracks in Spotify to see them here.</span>
            ) : (
              <span onClick={onLogin} style={{ cursor: 'pointer' }}>
                Connect Spotify to unlock Up Next queue & history ➔
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueuePanel;
