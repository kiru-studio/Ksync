class SpotifyService {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.isInitialized = false;
  }

  async init() {
    try {
      // Initialize the service
      this.isInitialized = true;
      console.log('Spotify service initialized');
    } catch (error) {
      console.error('Failed to initialize Spotify service:', error);
    }
  }

  async authenticate() {
    try {
      const response = await fetch(`${this.baseUrl}/auth/spotify`);
      const data = await response.json();
      
      // Open auth window
      const authWindow = window.open(data.authUrl, 'spotify-auth', 'width=400,height=600');
      
      return new Promise((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkClosed);
            resolve();
          }
        }, 1000);
      });
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }



  async getCurrentTrack() {
    try {
      const response = await fetch(`${this.baseUrl}/api/current-track`);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, redirect to auth
          await this.authenticate();
          return null;
        }
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting current track:', error);
      return null;
    }
  }

  async getQueue() {
    try {
      const response = await fetch(`${this.baseUrl}/api/queue`);
      
      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        return [];
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  }

  async getLyrics(trackId) {
    try {
      if (!trackId) return [];

      const response = await fetch(`${this.baseUrl}/api/lyrics/${trackId}`);
      
      if (!response.ok) {
        return this.getMockLyrics();
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting lyrics:', error);
      return this.getMockLyrics();
    }
  }

  getMockLyrics() {
    // Mock lyrics for demonstration
    return [
      { text: "I'd be your last love, everlasting, you and me", startTime: 0 },
      { text: "Mm, that was what you told me", startTime: 4 },
      { text: "I'm giving you up", startTime: 8 },
      { text: "But I'm still holding on", startTime: 12 },
      { text: "To the memories we made", startTime: 16 },
      { text: "And the promises we kept", startTime: 20 }
    ];
  }

  async play() {
    try {
      await fetch(`${this.baseUrl}/api/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error playing:', error);
    }
  }

  async pause() {
    try {
      await fetch(`${this.baseUrl}/api/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }

  async skipNext() {
    try {
      await fetch(`${this.baseUrl}/api/skip-next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error skipping next:', error);
    }
  }

  async skipPrevious() {
    try {
      await fetch(`${this.baseUrl}/api/skip-previous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error skipping previous:', error);
    }
  }

  async setVolume(volume) {
    try {
      await fetch(`${this.baseUrl}/api/volume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ volume })
      });
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  async seek(position) {
    try {
      await fetch(`${this.baseUrl}/api/seek`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ position })
      });
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }


}

export default new SpotifyService();
