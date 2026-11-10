import React, { useState, useEffect, useRef } from 'react';
import MarqueeText from './MarqueeText';

export default function DynamicIslandPeek() {
  const [track, setTrack] = useState(null);
  const [isShowing, setIsShowing] = useState(false);
  const dismissTimerRef = useRef(null);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    if (window.electronAPI.getCurrentPeekData) {
      window.electronAPI.getCurrentPeekData().then((data) => {
        if (data && data.title) {
          setTrack(data);
          setIsShowing(true);
        }
      });
    }

    if (window.electronAPI.onTrackPeekData) {
      const cleanup = window.electronAPI.onTrackPeekData((data) => {
        if (!data || !data.title) return;
        setTrack(data);
        setIsShowing(true);

        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        // Stay visible for 5 seconds before smoothly gliding back up
        dismissTimerRef.current = setTimeout(() => {
          if (!isHoveredRef.current) {
            triggerDismiss();
          }
        }, 5000);
      });

      return () => {
        if (cleanup) cleanup();
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      };
    }
  }, []);

  const triggerDismiss = () => {
    setIsShowing(false);
    setTimeout(() => {
      if (window.electronAPI && window.electronAPI.dismissTrackPeek) {
        window.electronAPI.dismissTrackPeek();
      }
    }, 450); // Match slide-up animation duration
  };

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      triggerDismiss();
    }, 1200);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (window.electronAPI && window.electronAPI.showDock) {
      window.electronAPI.showDock();
    }
    triggerDismiss();
  };

  if (!track) return null;

  const albumArt = track.albumArt || '/default-album-art.png';

  return (
    <div
      className={`dynamic-island-peek-stage ${isShowing ? 'visible' : 'hidden'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      title="Click to open full Ksync dock"
    >
      <div className="peek-capsule-island">
        {/* Album Art */}
        <div className="peek-art-cluster">
          <img
            src={albumArt}
            alt=""
            className="peek-art-thumb"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-album-art.png';
            }}
          />
        </div>

        {/* Track Title and Artist Meta */}
        <div className="peek-meta-col">
          <MarqueeText
            text={track.title || 'Unknown Track'}
            className="peek-title-text"
            speed={26}
          />
          <span className="peek-artist-text">
            {track.artist || 'Spotify'}
          </span>
        </div>

        {/* Acoustic Soundwave Pulse Bars */}
        <div className="peek-soundwave-cluster">
          <span className="peek-eq-bar bar-1" />
          <span className="peek-eq-bar bar-2" />
          <span className="peek-eq-bar bar-3" />
        </div>
      </div>
    </div>
  );
}
