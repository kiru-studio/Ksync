/**
 * Bridge to SMTC IPC for playback control on Free accounts.
 */

const api = typeof window !== 'undefined' && window.electronAPI;

async function ensureApi() {
  if (!api) throw new Error('Electron API not available');
}

let currentPlayerState = null;

let updateCallback = null;

// Listen to SMTC updates
if (api && api.onSmtcPlayerState) {
  api.onSmtcPlayerState((state) => {
    currentPlayerState = { ...state, serverTimestamp: Date.now() };
    if (updateCallback) updateCallback();
  });
}

export default {
  onStateChange(cb) {
    updateCallback = cb;
  },
  
  async init() {
    this.isInitialized = true;
  },

  async authenticate() {
    // SMTC does not require authentication
  },

  async hasTokens() {
    return true; // No tokens needed
  },

  async getCurrentTrack() {
    if (!currentPlayerState) return null;
    if (currentPlayerState.type === 'noSession' || !currentPlayerState.title) return null;
    
    // Normalize SMTC state to match the structure App.js expects from Spotify Web API
    return {
      ...currentPlayerState,
      id: `smtc-${currentPlayerState.title}-${currentPlayerState.artist}`,
      albumArt: currentPlayerState.artBase64,
      progressMs: currentPlayerState.positionMs,
    };
  },

  async getQueue(currentTrack = null) {
    if (api && api.spotifyGetQueue) {
      try {
        const trackToUse = currentTrack || (currentPlayerState ? {
          title: currentPlayerState.title,
          artist: currentPlayerState.artist,
          album: currentPlayerState.album,
        } : null);
        const q = await api.spotifyGetQueue(trackToUse);
        if (q && q.items && q.items.length) return q;
      } catch (_) {}
    }
    return { items: [] };
  },

  async play() {
    if (!api) return;
    try {
      await api.smtcPlay();
    } catch (err) {
      console.error('Error playing:', err);
    }
  },

  async playTrack(uri) {
    if (api && api.spotifyPlayTrack) {
      try {
        return await api.spotifyPlayTrack(uri);
      } catch (err) {
        console.error('[SMTCService] playTrack error:', err);
      }
    }
  },

  async pause() {
    if (!api) return;
    try {
      await api.smtcPause();
    } catch (err) {
      console.error('Error pausing:', err);
    }
  },

  async skipNext() {
    if (!api) return;
    try {
      await api.smtcSkipNext();
    } catch (err) {
      console.error('Error skipping next:', err);
    }
  },

  async skipPrevious() {
    if (!api) return;
    try {
      await api.smtcSkipPrevious();
    } catch (err) {
      console.error('Error skipping previous:', err);
    }
  },

  async setVolume(volume) {
    if (api && api.spotifySetVolume) {
      try {
        await api.spotifySetVolume(volume);
      } catch (_) {}
    }
  },

  async seek(positionSeconds) {
    if (!api) return;
    try {
      await api.smtcSeek(Math.round(positionSeconds * 1000));
    } catch (err) {
      console.error('Error seeking:', err);
    }
  },

  async setShuffle(state) {
    if (api && api.spotifySetShuffle) {
      try {
        const hasTokens = await api.spotifyHasTokens();
        if (hasTokens) {
          await api.spotifySetShuffle(state);
        }
      } catch (_) {}
    }
  },

  async setRepeat(state) {
    if (api && api.spotifySetRepeat) {
      try {
        const hasTokens = await api.spotifyHasTokens();
        if (hasTokens) {
          await api.spotifySetRepeat(state);
        }
      } catch (_) {}
    }
  },

  async getCurrentUser() {
    if (api && api.spotifyGetCurrentUser) {
      try {
        const hasTokens = await api.spotifyHasTokens();
        if (hasTokens) {
          return await api.spotifyGetCurrentUser();
        }
      } catch (_) {}
    }
    return { display_name: 'Local User' };
  },

  async getDevices() {
    if (api && api.spotifyGetDevices) {
      try {
        const hasTokens = await api.spotifyHasTokens();
        if (hasTokens) {
          const res = await api.spotifyGetDevices();
          if (res?.devices?.length) return res.devices;
        }
      } catch (_) {}
    }
    return [];
  },

  async transferPlayback(deviceIds, play = true) {
    if (api && api.spotifyTransferPlayback) {
      try {
        const hasTokens = await api.spotifyHasTokens();
        if (hasTokens) {
          const filtered = (deviceIds || []).filter((id) => id && id !== 'smtc');
          if (filtered.length) {
            return await api.spotifyTransferPlayback(filtered, play);
          }
        }
      } catch (err) {
        console.error('[SMTCService] transferPlayback error:', err);
        throw err;
      }
    }
  },

  logout() {
    if (api && api.spotifyLogout) api.spotifyLogout();
  },

  onLogoutDone(callback) {
    if (api && api.onSpotifyLogoutDone) api.onSpotifyLogoutDone(callback);
  },
};
