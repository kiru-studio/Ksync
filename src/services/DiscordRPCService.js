const net = require('net');
const crypto = require('crypto');

const DEFAULT_CLIENT_ID = '1565344513881411667'; // ksync Discord Application ID
const DEFAULT_PUBLIC_KEY = '830403cc06e95f9d1cd3ef64cb4e1eac37327e5a819b6aeca518cc020e8528f7';
const KSYNC_ICON_URL = 'https://cdn.discordapp.com/app-icons/1565344513881411667/2bbdab2f3f952153b750582c3abb1b79.png';

let SpotifyAPI = null;
let config = null;
try {
  SpotifyAPI = require('./SpotifyAPI.js');
  config = require('../../config.js');
} catch (_) {}

const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

class DiscordRPCService {
  constructor(options = {}) {
    this.clientId = options.clientId || DEFAULT_CLIENT_ID;
    this.enabled = options.enabled !== false;
    this.partySync = options.partySync !== false;
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isReady = false;
    this.pendingActivity = null;
    this.reconnectTimer = null;
    this.lastActivity = null;
    this.lastSentTimestamp = 0;
    this.throttleTimer = null;
    this.currentTrackData = null;
    this.trackCache = new Map();

    if (this.enabled) {
      this.connect();
    }
  }

  formatMs(ms) {
    if (!ms || ms <= 0) return '';
    const totalSec = Math.round(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async resolveTrackDetails(title, artist, album, currentArt, trackId) {
    if (!title) {
      return {
        albumArt: null,
        spotifyUrl: 'https://open.spotify.com',
        album: album || null,
        trackId: null,
      };
    }

    const hasHttpArt = currentArt && typeof currentArt === 'string' && currentArt.startsWith('http');
    const hasRealId = trackId && typeof trackId === 'string' && !trackId.startsWith('smtc-');

    if (hasHttpArt && hasRealId) {
      return {
        albumArt: currentArt,
        spotifyUrl: `https://open.spotify.com/track/${trackId}`,
        album: album || null,
        trackId,
      };
    }

    const cacheKey = `${(title || '').toLowerCase().trim()}:::${(artist || '').toLowerCase().trim()}`;
    if (this.trackCache.has(cacheKey)) {
      return this.trackCache.get(cacheKey);
    }

    // Strategy 1: Search via Spotify Web API Client Credentials
    if (SpotifyAPI && config && config.spotify) {
      try {
        const cleanTitle = (title || '')
          .replace(/\s*[\(\[](feat|ft|with|remaster|mix|version|deluxe|bonus|radio|edit|live).*?[\)\]]/gi, '')
          .trim();
        const primaryArtist = (artist || '').split(/[,&]/)[0].trim();
        const query = `${cleanTitle} ${primaryArtist}`.trim();

        const track = await SpotifyAPI.searchTrack(config.spotify, query);
        if (track) {
          const res = {
            albumArt: track.album?.images?.[0]?.url || (hasHttpArt ? currentArt : null),
            spotifyUrl: track.external_urls?.spotify || (track.id ? `https://open.spotify.com/track/${track.id}` : null),
            album: track.album?.name || album,
            trackId: track.id || null,
            title: track.name || title,
          };
          this.trackCache.set(cacheKey, res);
          return res;
        }
      } catch (_) {}
    }

    // Strategy 2: Multi-Storefront Apple Music / iTunes Search
    try {
      const cleanTitle = (title || '')
        .replace(/\s*[\(\[](feat|ft|with|remaster|mix|version|deluxe|bonus|radio|edit|live).*?[\)\]]/gi, '')
        .replace(/[\(\[]from\s+["']?[^"'\)\]]+["']?[\)\]]/gi, '')
        .trim();
      const primaryArtist = (artist || '').split(/[,&]/)[0].trim();

      const candidateUrls = [
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle + ' ' + primaryArtist)}&media=music&limit=3`,
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&country=IN&limit=3`,
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&media=music&limit=3`,
      ];

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
          if (res.ok) {
            const json = await res.json();
            const hit = json.results?.[0];
            const raw = hit?.artworkUrl100;
            if (raw) {
              const highRes = raw.replace('100x100bb', '600x600bb');
              const resObj = {
                albumArt: highRes,
                spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + (artist || ''))}`,
                album: hit?.collectionName || album,
                trackId: null,
              };
              this.trackCache.set(cacheKey, resObj);
              return resObj;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    // Strategy 3: Deezer public music catalog search (universal, fast, no auth)
    try {
      const cleanTitle = (title || '')
        .replace(/\s*[\(\[](feat|ft|with|remaster|mix|version|deluxe|bonus|radio|edit|live).*?[\)\]]/gi, '')
        .trim();
      const primaryArtist = (artist || '').split(/[,&]/)[0].trim();
      const dzUrl = `https://api.deezer.com/search?q=${encodeURIComponent(cleanTitle + ' ' + primaryArtist)}&limit=1`;
      const dzRes = await fetch(dzUrl, { signal: AbortSignal.timeout(2500) });
      if (dzRes.ok) {
        const dzJson = await dzRes.json();
        const hit = dzJson.data?.[0];
        const cover = hit?.album?.cover_big || hit?.album?.cover_xl || hit?.album?.cover_medium;
        if (cover) {
          const resObj = {
            albumArt: cover,
            spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + (artist || ''))}`,
            album: hit?.album?.title || album,
            trackId: null,
          };
          this.trackCache.set(cacheKey, resObj);
          return resObj;
        }
      }
    } catch (_) {}

    // Fallback: Default search URL and provided HTTP art
    const fallback = {
      albumArt: hasHttpArt ? currentArt : null,
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + (artist || ''))}`,
      album,
      trackId: null,
    };
    this.trackCache.set(cacheKey, fallback);
    return fallback;
  }

  getPipePath(id = 0) {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${id}`;
    }
    const env = process.env;
    const prefix = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
    return `${prefix.replace(/\/$/, '')}/discord-ipc-${id}`;
  }

  connect() {
    if (!this.enabled || this.isConnected || this.isConnecting) return;
    this.isConnecting = true;
    this.tryPipe(0);
  }

  tryPipe(pipeIndex) {
    if (pipeIndex > 9) {
      this.isConnecting = false;
      this.scheduleReconnect(25000);
      return;
    }

    const pipePath = this.getPipePath(pipeIndex);
    const sock = net.connect(pipePath);

    const cleanup = () => {
      sock.removeAllListeners();
      try { sock.destroy(); } catch (_) {}
    };

    sock.once('connect', () => {
      this.socket = sock;
      this.isConnected = true;
      this.isConnecting = false;
      this.isReady = false;
      this.setupSocketListeners();
      this.sendHandshake();
      console.log(`[DiscordRPC] Connected on ${pipePath}, waiting for READY event...`);
    });

    sock.once('error', () => {
      cleanup();
      this.tryPipe(pipeIndex + 1);
    });
  }

  setupSocketListeners() {
    if (!this.socket) return;

    let buffer = Buffer.alloc(0);

    this.socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 8) {
        const opcode = buffer.readInt32LE(0);
        const length = buffer.readInt32LE(4);

        if (buffer.length < 8 + length) {
          break;
        }

        const payloadStr = buffer.slice(8, 8 + length).toString('utf8');
        buffer = buffer.slice(8 + length);

        try {
          const payload = JSON.parse(payloadStr);
          if (payload.cmd === 'DISPATCH' && payload.evt === 'READY') {
            console.log(`[DiscordRPC] Handshake verified with Discord (User: ${payload.data?.user?.username || 'Unknown'})`);
            this.isReady = true;
            if (this.pendingActivity) {
              const pending = this.pendingActivity;
              this.pendingActivity = null;
              this.send(OPCODES.FRAME, pending);
            } else if (this.currentTrackData) {
              this.updateTrackActivity(this.currentTrackData);
            }
          } else if (payload.evt === 'ERROR') {
            console.warn('[DiscordRPC] Discord rejected presence:', payload.data?.message || payloadStr);
          }
        } catch (_) {}
      }
    });

    this.socket.on('close', () => {
      this.handleDisconnect();
    });

    this.socket.on('error', () => {
      this.handleDisconnect();
    });
  }

  handleDisconnect() {
    this.isConnected = false;
    this.isConnecting = false;
    this.isReady = false;
    this.pendingActivity = null;
    if (this.socket) {
      try { this.socket.destroy(); } catch (_) {}
      this.socket = null;
    }
    this.scheduleReconnect(15000);
  }

  scheduleReconnect(delayMs = 15000) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.enabled) return;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delayMs);
  }

  sendHandshake() {
    this.send(OPCODES.HANDSHAKE, {
      v: 1,
      client_id: this.clientId,
    });
  }

  send(opcode, payload) {
    if (!this.socket || !this.isConnected) return;

    try {
      const json = JSON.stringify(payload);
      const jsonLen = Buffer.byteLength(json, 'utf8');
      const packet = Buffer.alloc(8 + jsonLen);

      packet.writeInt32LE(opcode, 0);
      packet.writeInt32LE(jsonLen, 4);
      packet.write(json, 8, jsonLen, 'utf8');

      this.socket.write(packet);
    } catch (err) {
      console.warn('[DiscordRPC] Send error:', err.message);
    }
  }

  updateTrackActivity(data) {
    this.currentTrackData = data;
    if (!this.enabled) return;

    if (!this.isConnected && !this.isConnecting) {
      this.connect();
      return;
    }

    if (!data || !data.title) {
      this.clearActivity();
      return;
    }

    const cacheKey = `${(data.title || '').toLowerCase().trim()}:::${(data.artist || '').toLowerCase().trim()}`;
    const cachedMeta = this.trackCache.get(cacheKey);

    if (cachedMeta) {
      this.throttleDispatch(data, cachedMeta);
    } else {
      this.throttleDispatch(data, null);

      this.resolveTrackDetails(data.title, data.artist, data.album, data.albumArt, data.trackId).then((resolvedMeta) => {
        if (
          resolvedMeta &&
          this.currentTrackData &&
          this.currentTrackData.title === data.title
        ) {
          this.dispatchActivity(this.currentTrackData, resolvedMeta);
        }
      });
    }
  }

  throttleDispatch(data, meta) {
    const now = Date.now();
    const timeSinceLast = now - this.lastSentTimestamp;

    if (timeSinceLast < 1500) {
      if (this.throttleTimer) clearTimeout(this.throttleTimer);
      this.throttleTimer = setTimeout(() => {
        this.dispatchActivity(this.currentTrackData || data, meta);
      }, 1600 - timeSinceLast);
      return;
    }

    this.dispatchActivity(data, meta);
  }

  dispatchActivity(data, resolvedMeta = null) {
    this.lastSentTimestamp = Date.now();
    const {
      title,
      artist,
      album,
      albumArt,
      durationMs,
      positionMs,
      isPlaying,
      trackId,
    } = data;

    const cacheKey = `${(title || '').toLowerCase().trim()}:::${(artist || '').toLowerCase().trim()}`;
    const meta = resolvedMeta || this.trackCache.get(cacheKey) || {};

    const liveArtUrl = meta.albumArt || (albumArt && typeof albumArt === 'string' && albumArt.startsWith('http') ? albumArt : null);
    const spotifyUrl = meta.spotifyUrl || (trackId && !trackId.startsWith('smtc-') ? `https://open.spotify.com/track/${trackId}` : `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + (artist || ''))}`);
    const displayAlbum = meta.album || album;

    const durStr = this.formatMs(durationMs);
    const largeHoverText = [displayAlbum || title, durStr].filter(Boolean).join(' • ');

    const activity = {
      type: 2, // 2 = "Listening to Ksync"
      details: (title || 'Unknown Track').slice(0, 128),
      state: (artist ? `by ${artist}` : 'ksync').slice(0, 128),
      assets: liveArtUrl
        ? {
            large_image: liveArtUrl,
            large_text: largeHoverText.slice(0, 128),
            small_image: KSYNC_ICON_URL,
            small_text: isPlaying ? 'Listening on Ksync' : 'Ksync • Paused',
          }
        : {
            large_image: KSYNC_ICON_URL,
            large_text: (displayAlbum || title || 'ksync').slice(0, 128),
            small_image: KSYNC_ICON_URL,
            small_text: isPlaying ? 'Listening on Ksync' : 'Ksync • Paused',
          },
      instance: false,
    };

    // Calculate dynamic track timestamps for live Spotify progress bar on Discord (only when playing)
    if (isPlaying && durationMs && durationMs > 0) {
      const now = Date.now();
      const pos = Math.max(0, positionMs || 0);
      const startSec = Math.floor((now - pos) / 1000);
      const endSec = Math.floor((now + (durationMs - pos)) / 1000);
      activity.timestamps = {
        start: startSec,
        end: endSec,
      };
    }

    // Action buttons (up to 2 allowed by Discord).
    // Note: Discord RPC strictly forbids sending 'party' and 'buttons' together (they are mutually exclusive).
    // We prioritize interactive action buttons so users and friends can jump to Spotify and get ksync.
    activity.buttons = [
      {
        label: this.partySync ? '🎧 Listen Along on Spotify' : 'Listen on Spotify',
        url: spotifyUrl,
      },
      {
        label: '⚡ Get ksync',
        url: 'https://github.com/KiruthikKumar16/ksync',
      },
    ];

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity,
      },
      nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    };

    if (!this.isConnected || !this.isReady) {
      this.pendingActivity = payload;
      if (!this.isConnected && !this.isConnecting) {
        this.connect();
      }
      return;
    }

    this.send(OPCODES.FRAME, payload);
  }

  clearActivity() {
    this.currentTrackData = null;
    this.pendingActivity = null;
    if (!this.isConnected || !this.isReady) return;

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null,
      },
      nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    };

    this.send(OPCODES.FRAME, payload);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.clearActivity();
      if (this.socket) {
        try { this.socket.destroy(); } catch (_) {}
        this.socket = null;
      }
      this.isConnected = false;
      this.isConnecting = false;
    } else {
      this.connect();
    }
  }

  setClientId(clientId) {
    if (clientId && clientId !== this.clientId) {
      this.clientId = clientId;
      if (this.isConnected) {
        this.handleDisconnect();
        this.connect();
      }
    }
  }

  setPartySync(enabled) {
    this.partySync = !!enabled;
    if (this.currentTrackData) {
      this.updateTrackActivity(this.currentTrackData);
    }
  }

  destroy() {
    this.enabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    if (this.socket) {
      try { this.socket.destroy(); } catch (_) {}
      this.socket = null;
    }
  }
}

module.exports = DiscordRPCService;
