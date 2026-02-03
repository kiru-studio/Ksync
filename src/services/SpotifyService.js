/**
 * Bridge to Electron IPC for Spotify API and LyricsService for lyrics.
 * No backend server required.
 */
import LyricsService from './LyricsService';

const api = typeof window !== 'undefined' && window.electronAPI;

async function ensureApi() {
  if (!api) throw new Error('Electron API not available');
}

export default {
  async init() {
    try {
      await ensureApi();
      this.isInitialized = true;
    } catch (_) {
      this.isInitialized = true;
    }
  },

  async authenticate() {
    await ensureApi();
    const result = await api.spotifyLogin();
    if (!result.ok) throw new Error(result.error || 'Login failed');
  },

  async hasTokens() {
    if (!api) return false;
    return api.spotifyHasTokens();
  },

  async getCurrentTrack() {
    if (!api) return null;
    try {
      return await api.spotifyGetPlayer();
    } catch (err) {
      if (err.message === 'Not authenticated') throw err;
      return null;
    }
  },

  async getQueue() {
    if (!api) return { items: [] };
    try {
      const data = await api.spotifyGetQueue();
      return data && data.items ? data : { items: [] };
    } catch (_) {
      return { items: [] };
    }
  },

  async getLyrics(trackId, track = null) {
    if (!trackId) return { lines: [], provider: null };
    try {
      const result = await LyricsService.getLyrics({
        trackId,
        title: track?.title,
        artist: track?.artist,
        album: track?.album,
      });
      if (!result) return { lines: [], provider: null };
      return { lines: result.lines || [], provider: result.provider || null };
    } catch (_) {
      return { lines: [], provider: null };
    }
  },

  async play() {
    if (!api) return;
    try {
      await api.spotifyPlay();
    } catch (err) {
      console.error('Error playing:', err);
    }
  },

  async playTrack(uri) {
    if (!api || !uri) return;
    try {
      await api.spotifyPlayTrack(uri);
    } catch (err) {
      console.error('Error playing track:', err);
    }
  },

  async pause() {
    if (!api) return;
    try {
      await api.spotifyPause();
    } catch (err) {
      console.error('Error pausing:', err);
    }
  },

  async skipNext() {
    if (!api) return;
    try {
      await api.spotifySkipNext();
    } catch (err) {
      console.error('Error skipping next:', err);
    }
  },

  async skipPrevious() {
    if (!api) return;
    try {
      await api.spotifySkipPrevious();
    } catch (err) {
      console.error('Error skipping previous:', err);
    }
  },

  async setVolume(volume) {
    if (!api) return;
    try {
      await api.spotifySetVolume(volume);
    } catch (err) {
      console.error('Error setting volume:', err);
    }
  },

  async seek(positionSeconds) {
    if (!api) return;
    try {
      await api.spotifySeek(Math.round(positionSeconds * 1000));
    } catch (err) {
      console.error('Error seeking:', err);
    }
  },

  async setShuffle(state) {
    if (!api) return;
    try {
      await api.spotifySetShuffle(!!state);
    } catch (err) {
      console.error('Error setting shuffle:', err);
    }
  },

  async setRepeat(state) {
    if (!api) return;
    try {
      await api.spotifySetRepeat(state);
    } catch (err) {
      console.error('Error setting repeat:', err);
    }
  },

  async getCurrentUser() {
    if (!api) return null;
    try {
      return await api.spotifyGetCurrentUser();
    } catch (_) {
      return null;
    }
  },

  async getDevices() {
    if (!api) return [];
    try {
      const data = await api.spotifyGetDevices();
      return data?.devices || [];
    } catch (_) {
      return [];
    }
  },

  async transferPlayback(deviceIds, play = true) {
    if (!api) return;
    try {
      await api.spotifyTransferPlayback(deviceIds, play);
    } catch (err) {
      console.error('Error transferring playback:', err);
    }
  },

  logout() {
    if (api) api.spotifyLogout();
  },

  onLogoutDone(callback) {
    if (api) api.onSpotifyLogoutDone(callback);
  },
};
