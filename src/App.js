import React, { useState, useEffect, useRef } from 'react';
import NowPlaying from './components/NowPlaying';
import LyricsPanel from './components/LyricsPanel';
import QueuePanel from './components/QueuePanel';
import SpotifyService from './services/SpotifyService';

function App() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [queue, setQueue] = useState([]);
  const [lyrics, setLyrics] = useState([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0); // user-adjustable
  const tickRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const baseProgressSecRef = useRef(0);
  const baseTimestampMsRef = useRef(Date.now());
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Listen for dock visibility changes from Electron
    if (window.electronAPI) {
      window.electronAPI.onDockVisibilityChange((visible) => {
        console.log('Dock visibility changed:', visible);
        setIsVisible(visible);
      });
    }

    // Initialize Spotify service
    SpotifyService.init();
    
    // Set up event listeners for mouse enter/leave
    const handleMouseEnter = () => {
      if (window.electronAPI) {
        window.electronAPI.onMouseEnter();
      }
    };

    const handleMouseLeave = () => {
      if (window.electronAPI) {
        window.electronAPI.onMouseLeave();
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Start polling for Spotify data
    const interval = setInterval(() => {
      updateSpotifyData();
    }, 1000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const updateSpotifyData = async () => {
    try {
      const trackData = await SpotifyService.getCurrentTrack();
      if (trackData) {
        setCurrentTrack(trackData);
        setIsPlaying(!!trackData.isPlaying);
        isPlayingRef.current = !!trackData.isPlaying;

        // Normalize units (ms vs seconds)
        let durationSec = trackData.durationMs ?? trackData.duration ?? 0;
        durationSec = durationSec > 10000 ? durationSec / 1000 : durationSec;

        let progressSec = trackData.progressMs ?? trackData.progress ?? 0;
        progressSec = progressSec > 10000 ? progressSec / 1000 : progressSec;

        // Drift correction using serverTimestamp if provided
        if (trackData.serverTimestamp) {
          const serverTs = new Date(trackData.serverTimestamp).getTime();
          if (!Number.isNaN(serverTs) && trackData.isPlaying) {
            const driftSec = (Date.now() - serverTs) / 1000;
            progressSec += Math.max(0, driftSec);
          }
        }

        // Clamp
        if (durationSec > 0) {
          progressSec = Math.max(0, Math.min(progressSec, durationSec));
        }
        // Save base for smooth ticking
        baseProgressSecRef.current = progressSec;
        baseTimestampMsRef.current = Date.now();

        setProgress(progressSec);
        setDuration(durationSec);
        if (typeof trackData.volume === 'number') setVolume(trackData.volume);
      }

      const queueData = await SpotifyService.getQueue();
      if (queueData) {
        setQueue(queueData);
      }

      // Handle lyric refresh on track change
      const newTrackId = trackData?.id || trackData?.trackId || trackData?.track?.id || null;
      if (newTrackId !== lastTrackIdRef.current) {
        lastTrackIdRef.current = newTrackId;
        setLyrics([]);
        setCurrentLyricIndex(0);
        if (newTrackId) {
          let lyricsData = await SpotifyService.getLyrics(newTrackId);
          // Normalize lyric start times to seconds
          if (Array.isArray(lyricsData)) {
            lyricsData = lyricsData.map(l => ({
              ...l,
              startTime: (l.startTime ?? l.time ?? 0) > 10000 ? (l.startTime ?? l.time) / 1000 : (l.startTime ?? l.time ?? 0)
            }));
          }
          if (lyricsData) {
            setLyrics(lyricsData);
            updateCurrentLyric(baseProgressSecRef.current || 0, lyricsData);
          }
        }
      } else if ((!lyrics || lyrics.length === 0) && newTrackId) {
        // If lyrics somehow empty, fetch once
        let lyricsData = await SpotifyService.getLyrics(newTrackId);
        if (Array.isArray(lyricsData)) {
          lyricsData = lyricsData.map(l => ({
            ...l,
            startTime: (l.startTime ?? l.time ?? 0) > 10000 ? (l.startTime ?? l.time) / 1000 : (l.startTime ?? l.time ?? 0)
          }));
        }
        if (lyricsData) {
          setLyrics(lyricsData);
          updateCurrentLyric(baseProgressSecRef.current || 0, lyricsData);
        }
      }
    } catch (error) {
      console.error('Error updating Spotify data:', error);
    }
  };

  const updateCurrentLyric = (currentTime, lyricsArray) => {
    if (!lyricsArray || lyricsArray.length === 0) return;

    // Apply offset (ms or s agnostic)
    const offsetSec = Math.abs(lyricsOffsetMs) > 100 ? lyricsOffsetMs / 1000 : lyricsOffsetMs;
    const t = Math.max(0, currentTime + offsetSec);

    const currentIndex = lyricsArray.findIndex((lyric, index) => {
      const nextLyric = lyricsArray[index + 1];
      return t >= lyric.startTime && (!nextLyric || t < nextLyric.startTime);
    });

    if (currentIndex !== -1 && currentIndex !== currentLyricIndex) {
      setCurrentLyricIndex(currentIndex);
    }
  };

  // Smooth ticking for better lyric sync between polls
  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (isPlaying) {
      tickRef.current = setInterval(() => {
        // compute elapsed since last server tick
        const elapsedSec = (Date.now() - baseTimestampMsRef.current) / 1000;
        const computed = Math.min((baseProgressSecRef.current || 0) + elapsedSec, duration || 0);
        setProgress(computed);
        if (lyrics && lyrics.length) {
          updateCurrentLyric(computed, lyrics);
        }
      }, 250);
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isPlaying, duration, lyrics]);

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await SpotifyService.pause();
      } else {
        await SpotifyService.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  const handleSkip = async (direction) => {
    try {
      if (direction === 'next') {
        await SpotifyService.skipNext();
      } else {
        await SpotifyService.skipPrevious();
      }
    } catch (error) {
      console.error('Error skipping track:', error);
    }
  };

  const handleVolumeChange = async (newVolume) => {
    try {
      await SpotifyService.setVolume(newVolume);
      setVolume(newVolume);
    } catch (error) {
      console.error('Error changing volume:', error);
    }
  };

  const handleProgressChange = async (newProgress) => {
    try {
      await SpotifyService.seek(newProgress);
      setProgress(newProgress);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  console.log('Current isVisible state:', isVisible);
  
  return (
    <div 
      className={`app ${isVisible ? 'slide-down' : 'slide-up'}`}
      style={{ 
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden'
      }}
    >
      <div className="dock-container">
        <div className="panel-left">
          <NowPlaying
            track={currentTrack}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            volume={volume}
            onPlayPause={handlePlayPause}
            onSkip={handleSkip}
            onVolumeChange={handleVolumeChange}
            onProgressChange={handleProgressChange}
          />
        </div>
        <div className="panel-center">
          <LyricsPanel
            lyrics={lyrics}
            currentIndex={currentLyricIndex}
          />
        </div>
        <div className="panel-right">
          <QueuePanel
            queue={queue}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
