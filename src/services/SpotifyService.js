/**
 * Bridge to Electron IPC for Spotify API and LyricsService for lyrics.
 * Routes to SMTCService if playbackBackend is 'smtc' with seamless fallback
 * to Spotify Web API for Spotify Connect endpoints and remote acoustic playback.
 */
import LyricsService from './LyricsService';
import SMTCService from './SMTCService';

const api = typeof window !== 'undefined' && window.electronAPI;

async function ensureApi() {
  if (!api) throw new Error('Electron API not available');
}

let stateChangeCb = null;

export default {
  backend: 'smtc', // Default, updated in init
  isInitialized: false,
  activePlaybackSource: 'smtc', // 'smtc' | 'webapi'

  onStateChange(cb) {
    stateChangeCb = cb;
    if (this.backend === 'smtc' && this.isInitialized) {
      SMTCService.onStateChange(cb);
    }
  },

  async init() {
    try {
      await ensureApi();
      if (api.getPlaybackBackend) {
        this.backend = await api.getPlaybackBackend();
      }
      if (this.backend === 'smtc') {
        await SMTCService.init();
        if (stateChangeCb) SMTCService.onStateChange(stateChangeCb);
      }
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

    let hasTokens = false;
    try {
      hasTokens = await api.spotifyHasTokens();
    } catch (_) {}

    // 1. If user is authenticated with Spotify Web API, perform smart hybrid resolution:
    // Local desktop SMTC (0ms) + remote Spotify Connect devices (Phone, TV, Speaker, Web, Console)
    if (hasTokens) {
      try {
        // Query local Windows SMTC state
        let smtcTrack = null;
        try {
          smtcTrack = await SMTCService.getCurrentTrack();
        } catch (_) {}
        const isSmtcValid = smtcTrack && smtcTrack.title && smtcTrack.type !== 'noSession';

        // If local desktop Spotify is actively playing music, use SMTC immediately (0ms hardware latency)
        if (isSmtcValid && smtcTrack.isPlaying) {
          this.activePlaybackSource = 'smtc';
          return smtcTrack;
        }

        // Otherwise, check Spotify Web API for active Spotify Connect playback across all user devices
        let webPlayer = null;
        try {
          webPlayer = await api.spotifyGetPlayer();
        } catch (err) {
          if (err.message !== 'Not authenticated') {
            console.warn('[SpotifyService] Web API getCurrentTrack warning:', err.message);
          }
        }

        // If another device (Phone, TV, Speaker, Console, Browser) is actively playing, prioritize Web API!
        if (webPlayer && webPlayer.title && webPlayer.isPlaying) {
          this.activePlaybackSource = 'webapi';
          return webPlayer;
        }

        // If neither is actively playing, prefer whichever has a valid track session
        if (webPlayer && webPlayer.title) {
          this.activePlaybackSource = 'webapi';
          return webPlayer;
        }
        if (isSmtcValid) {
          this.activePlaybackSource = 'smtc';
          return smtcTrack;
        }
      } catch (err) {
        console.warn('[SpotifyService] Hybrid getCurrentTrack error:', err.message);
      }
    }

    // 2. Fallback when not authenticated: direct local Windows SMTC
    const smtcTrack = await SMTCService.getCurrentTrack();
    if (smtcTrack && smtcTrack.title && smtcTrack.type !== 'noSession') {
      this.activePlaybackSource = 'smtc';
      return smtcTrack;
    }

    return null;
  },

  async getQueue(currentTrack = null) {
    if (!api || !api.spotifyGetQueue) return { items: [] };
    try {
      // Windows SMTC has no queue concept. Spotify Web API handles user queue,
      // playlist/album context tracks, and smart music fallback in Electron main!
      const data = await api.spotifyGetQueue(currentTrack);
      return data && data.items ? data : { items: [] };
    } catch (err) {
      console.warn('[SpotifyService] getQueue error:', err.message);
      return { items: [] };
    }
  },

  async getLyrics(trackId, track = null) {
    if (!trackId && !track?.title) return { lines: [], provider: null };
    const trackPayload = {
      trackId,
      title: track?.title,
      artist: track?.artist,
      album: track?.album,
      duration: track?.duration || (track?.durationMs ? track.durationMs / 1000 : (track?.duration_ms ? track.duration_ms / 1000 : 0)),
    };
    if (api && api.spotifyGetLyrics) {
      try {
        const res = await api.spotifyGetLyrics(trackPayload);
        if (res && res.lines && res.lines.length) return res;
      } catch (err) {
        console.error('[SpotifyService] IPC getLyrics error:', err);
      }
    }
    try {
      const result = await LyricsService.getLyrics(trackPayload);
      if (!result) return { lines: [], provider: null };
      return { lines: result.lines || [], provider: result.provider || null };
    } catch (_) {
      return { lines: [], provider: null };
    }
  },

  async play() {
    if (this.activePlaybackSource === 'webapi') {
      try {
        const hasTokens = await api?.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifyPlay();
        }
      } catch (err) {
        console.warn('[SpotifyService] Web API play fallback to SMTC:', err.message);
      }
    }
    if (this.backend === 'smtc') {
      const smtcTrack = await SMTCService.getCurrentTrack();
      if (smtcTrack && smtcTrack.title) {
        return SMTCService.play();
      }
    }
    if (!api) return;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        await api.spotifyPlay();
      } else if (this.backend === 'smtc') {
        await SMTCService.play();
      }
    } catch (err) {
      console.error('Error playing:', err);
    }
  },

  async playTrack(uriOrPayload, contextUri = null) {
    if (!api || !uriOrPayload) return;
    const payload = typeof uriOrPayload === 'string'
      ? { uri: uriOrPayload, contextUri }
      : uriOrPayload;

    try {
      if (api.spotifyPlayTrack) {
        return await api.spotifyPlayTrack(payload);
      }
    } catch (err) {
      console.warn('[SpotifyService] playTrack error:', err.message);
    }
    if (this.backend === 'smtc') {
      return SMTCService.playTrack(payload.uri || payload);
    }
  },

  async pause() {
    if (this.activePlaybackSource === 'webapi') {
      try {
        const hasTokens = await api?.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifyPause();
        }
      } catch (err) {
        console.warn('[SpotifyService] Web API pause fallback to SMTC:', err.message);
      }
    }
    if (this.backend === 'smtc') {
      const smtcTrack = await SMTCService.getCurrentTrack();
      if (smtcTrack && smtcTrack.title) {
        return SMTCService.pause();
      }
    }
    if (!api) return;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        await api.spotifyPause();
      } else if (this.backend === 'smtc') {
        await SMTCService.pause();
      }
    } catch (err) {
      console.error('Error pausing:', err);
    }
  },

  async skipNext() {
    if (this.activePlaybackSource === 'webapi') {
      try {
        const hasTokens = await api?.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifySkipNext();
        }
      } catch (err) {
        console.warn('[SpotifyService] Web API skipNext fallback to SMTC:', err.message);
      }
    }
    if (this.backend === 'smtc') {
      const smtcTrack = await SMTCService.getCurrentTrack();
      if (smtcTrack && smtcTrack.title) {
        return SMTCService.skipNext();
      }
    }
    if (!api) return;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        await api.spotifySkipNext();
      } else if (this.backend === 'smtc') {
        await SMTCService.skipNext();
      }
    } catch (err) {
      console.error('Error skipping next:', err);
    }
  },

  async skipPrevious() {
    if (this.activePlaybackSource === 'webapi') {
      try {
        const hasTokens = await api?.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifySkipPrevious();
        }
      } catch (err) {
        console.warn('[SpotifyService] Web API skipPrevious fallback to SMTC:', err.message);
      }
    }
    if (this.backend === 'smtc') {
      const smtcTrack = await SMTCService.getCurrentTrack();
      if (smtcTrack && smtcTrack.title) {
        return SMTCService.skipPrevious();
      }
    }
    if (!api) return;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        await api.spotifySkipPrevious();
      } else if (this.backend === 'smtc') {
        await SMTCService.skipPrevious();
      }
    } catch (err) {
      console.error('Error skipping previous:', err);
    }
  },

  async setVolume(volume) {
    if (!api || !api.spotifySetVolume) return;
    try {
      // Direct IPC call attempts Spotify Web API (Spotify Connect remote endpoints) and automatically falls back to Windows WASAPI Spotify process volume (desktop)
      await api.spotifySetVolume(volume);
    } catch (err) {
      console.error('Error setting volume:', err);
    }
  },

  async seek(positionSeconds) {
    if (this.activePlaybackSource === 'webapi') {
      try {
        const hasTokens = await api?.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifySeek(Math.round(positionSeconds * 1000));
        }
      } catch (err) {
        console.warn('[SpotifyService] Web API seek fallback to SMTC:', err.message);
      }
    }
    if (this.backend === 'smtc') {
      const smtcTrack = await SMTCService.getCurrentTrack();
      if (smtcTrack && smtcTrack.title) {
        return SMTCService.seek(positionSeconds);
      }
    }
    if (!api) return;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        await api.spotifySeek(Math.round(positionSeconds * 1000));
      } else if (this.backend === 'smtc') {
        await SMTCService.seek(positionSeconds);
      }
    } catch (err) {
      console.error('Error seeking:', err);
    }
  },

  async setShuffle(state) {
    if (this.activePlaybackSource === 'webapi') {
      try {
        const hasTokens = await api?.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifySetShuffle(!!state);
        }
      } catch (_) {}
    }
    if (this.backend === 'smtc') {
      const smtcTrack = await SMTCService.getCurrentTrack();
      if (smtcTrack && smtcTrack.title) {
        return SMTCService.setShuffle(state);
      }
    }
    if (!api) return;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        await api.spotifySetShuffle(!!state);
      } else if (this.backend === 'smtc') {
        await SMTCService.setShuffle(state);
      }
    } catch (err) {
      console.error('Error setting shuffle:', err);
    }
  },

  async setRepeat(state) {
    if (this.activePlaybackSource === 'webapi') {
      try {
        const hasTokens = await api?.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifySetRepeat(state);
        }
      } catch (_) {}
    }
    if (this.backend === 'smtc') {
      const smtcTrack = await SMTCService.getCurrentTrack();
      if (smtcTrack && smtcTrack.title) {
        return SMTCService.setRepeat(state);
      }
    }
    if (!api) return;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        await api.spotifySetRepeat(state);
      } else if (this.backend === 'smtc') {
        await SMTCService.setRepeat(state);
      }
    } catch (err) {
      console.error('Error setting repeat:', err);
    }
  },

  async getCurrentUser() {
    if (!api) return null;
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        return await api.spotifyGetCurrentUser();
      }
    } catch (_) {}
    return { display_name: 'Local User' };
  },

  async getDevices() {
    if (!api) return [];
    try {
      const hasTokens = await api.spotifyHasTokens();
      if (hasTokens) {
        const data = await api.spotifyGetDevices();
        const list = (data?.devices || []).filter((d) => d && d.id !== 'smtc');
        return list;
      }
    } catch (err) {
      console.warn('[SpotifyService] getDevices error:', err);
    }
    return [];
  },

  async transferPlayback(deviceIds, play = true) {
    if (!api) return { ok: false, error: 'Electron API unavailable' };
    const filtered = (deviceIds || []).filter((id) => id && id !== 'smtc');
    if (!filtered.length) {
      return { ok: false, error: 'No valid device ID provided' };
    }
    try {
      const res = await api.spotifyTransferPlayback(filtered, play);
      return { ok: true, data: res };
    } catch (err) {
      console.error('[SpotifyService] transferPlayback error:', err);
      return { ok: false, error: err.message || 'Transfer failed' };
    }
  },

  async checkSavedTracks(payload) {
    if (!api || !api.spotifyCheckSavedTracks) return [];
    try {
      return await api.spotifyCheckSavedTracks(payload);
    } catch (_) {
      return [];
    }
  },

  async saveTrack(payload) {
    if (!api || !api.spotifySaveTrack) return { ok: false };
    try {
      return await api.spotifySaveTrack(payload);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async removeTrack(payload) {
    if (!api || !api.spotifyRemoveTrack) return { ok: false };
    try {
      return await api.spotifyRemoveTrack(payload);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async getAudioFeatures(payload) {
    if (!api || !api.spotifyGetAudioFeatures) return null;
    try {
      return await api.spotifyGetAudioFeatures(payload);
    } catch (_) {
      return null;
    }
  },

  logout() {
    if (api) api.spotifyLogout();
  },

  onLogoutDone(callback) {
    if (api && api.onSpotifyLogoutDone) api.onSpotifyLogoutDone(callback);
  },

  onLoginDone(callback) {
    if (api && api.onSpotifyLoginDone) api.onSpotifyLoginDone(callback);
  },
};
