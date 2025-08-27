import React, { useState, useEffect } from 'react';
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
        setIsPlaying(trackData.isPlaying);
        setProgress(trackData.progress);
        setDuration(trackData.duration);
        setVolume(trackData.volume);
      }

      const queueData = await SpotifyService.getQueue();
      if (queueData) {
        setQueue(queueData);
      }

      const lyricsData = await SpotifyService.getLyrics(trackData?.id);
      if (lyricsData) {
        setLyrics(lyricsData);
        updateCurrentLyric(trackData?.progress || 0, lyricsData);
      }
    } catch (error) {
      console.error('Error updating Spotify data:', error);
    }
  };

  const updateCurrentLyric = (currentTime, lyricsArray) => {
    if (!lyricsArray || lyricsArray.length === 0) return;

    const currentIndex = lyricsArray.findIndex((lyric, index) => {
      const nextLyric = lyricsArray[index + 1];
      return currentTime >= lyric.startTime && 
             (!nextLyric || currentTime < nextLyric.startTime);
    });

    if (currentIndex !== -1 && currentIndex !== currentLyricIndex) {
      setCurrentLyricIndex(currentIndex);
    }
  };

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
        
        <LyricsPanel
          lyrics={lyrics}
          currentIndex={currentLyricIndex}
        />
        
        <QueuePanel
          queue={queue}
        />
      </div>
    </div>
  );
}

export default App;
