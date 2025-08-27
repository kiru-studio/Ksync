class SpotifyService {
  constructor() {
    this.baseUrl = 'https://ksync.onrender.com';
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

  async request(path, { method = 'GET', body, headers = {} } = {}, retry = true) {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          ...headers,
        },
        cache: 'no-store',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401 && retry) {
        await this.authenticate();
        return this.request(path, { method, body, headers }, false);
      }

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      try {
        return await response.json();
      } catch (_) {
        return null;
      }
    } catch (error) {
      console.error(`Request error for ${path}:`, error);
      throw error;
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
      const data = await this.request('/api/current-track');
      return data || null;
    } catch (error) {
      console.error('Error getting current track:', error);
      return null;
    }
  }

  async getQueue() {
    try {
      const data = await this.request('/api/queue').catch(() => ({ items: [] }));
      return data && data.items ? data : { items: [] };
    } catch (error) {
      console.error('Error getting queue:', error);
      return { items: [] };
    }
  }

  async getLyrics(trackId) {
    try {
      if (!trackId) return [];

      // cache-bust param to avoid any upstream caching
      const data = await this.request(`/api/lyrics/${encodeURIComponent(trackId)}?ts=${Date.now()}`).catch(() => []);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error getting lyrics:', error);
      return [];
    }
  }

  getMockLyrics() { return []; }

  async play() {
    try {
      await this.request('/api/play', { method: 'POST' });
    } catch (error) {
      console.error('Error playing:', error);
    }
  }

  async pause() {
    try {
      await this.request('/api/pause', { method: 'POST' });
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }

  async skipNext() {
    try {
      await this.request('/api/skip-next', { method: 'POST' });
    } catch (error) {
      console.error('Error skipping next:', error);
    }
  }

  async skipPrevious() {
    try {
      await this.request('/api/skip-previous', { method: 'POST' });
    } catch (error) {
      console.error('Error skipping previous:', error);
    }
  }

  async setVolume(volume) {
    try {
      await this.request('/api/volume', { method: 'POST', body: { volume } });
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  async seek(position) {
    try {
      await this.request('/api/seek', { method: 'POST', body: { position } });
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }


}

export default new SpotifyService();
