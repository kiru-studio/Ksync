/**
 * Multi-provider lyrics with fallback chain.
 * Provider 1: spotify-lyrics-api (synced, best coverage)
 * Provider 2: LRCLIB (synced/plain)
 * Provider 3: Genius (plain, optional API key)
 */

const SPOTIFY_LYRICS_API = 'https://spotify-lyrics-api-pi.vercel.app';
const LRCLIB_SEARCH = 'https://lrclib.net/api/search';

const lyricsCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(trackId) {
  const entry = lyricsCache.get(trackId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    lyricsCache.delete(trackId);
    return null;
  }
  return entry.data;
}

function setCached(trackId, data) {
  lyricsCache.set(trackId, { data, ts: Date.now() });
}

function normalizeLines(lines, provider) {
  if (!Array.isArray(lines)) return [];
  return lines.map((line) => {
    const text = line.text ?? line.words ?? line.line ?? '';
    let startTime = line.startTime ?? line.time ?? 0;
    if (typeof line.startTimeMs === 'string') startTime = parseInt(line.startTimeMs, 10) / 1000;
    if (typeof line.startTimeMs === 'number') startTime = line.startTimeMs / 1000;
    if (line.timeTag && typeof line.timeTag === 'string') {
      const match = line.timeTag.match(/^(\d{1,2}):(\d{2})\.(\d+)$/);
      if (match) startTime = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + parseInt(match[3], 10) / 1000;
    }
    return { text, startTime };
  });
}

async function trySpotifyLyricsApi(trackId) {
  const url = `${SPOTIFY_LYRICS_API}/?trackid=${encodeURIComponent(trackId)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error || !data.lines || !data.lines.length) return null;
  const lines = (data.lines || []).map((line) => ({
    text: line.words ?? line.text ?? '',
    startTime: typeof line.startTimeMs === 'string' ? parseInt(line.startTimeMs, 10) / 1000 : (line.startTimeMs || 0) / 1000,
  }));
  return { lines, provider: 'Spotify (Musixmatch)' };
}

function parseLrc(lrcText) {
  const lines = [];
  const timeTag = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/;
  const parts = lrcText.split(/\r?\n/);
  for (const line of parts) {
    const match = line.match(timeTag);
    if (!match) continue;
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
    const startTime = min * 60 + sec + ms / 1000;
    const text = (match[4] || '').trim();
    if (text) lines.push({ text, startTime });
  }
  lines.sort((a, b) => a.startTime - b.startTime);
  return lines;
}

async function tryLrclib(trackName, artistName, albumName) {
  const params = new URLSearchParams({
    track_name: trackName || '',
    artist_name: artistName || '',
    album_name: albumName || '',
  });
  const res = await fetch(`${LRCLIB_SEARCH}?${params}`);
  if (!res.ok) return null;
  const arr = await res.json();
  const first = Array.isArray(arr) ? arr[0] : null;
  if (!first) return null;
  if (first.syncedLyrics) {
    const lines = parseLrc(first.syncedLyrics);
    return { lines, provider: 'LRCLIB' };
  }
  if (first.plainLyrics) {
    const lines = first.plainLyrics.split(/\r?\n/).filter(Boolean).map((text, i) => ({ text, startTime: i * 3 }));
    return { lines, provider: 'LRCLIB (plain)' };
  }
  return null;
}

/**
 * Fetch lyrics for a track. Tries spotify-lyrics-api, then LRCLIB.
 * @param {{ trackId: string, title?: string, artist?: string, album?: string }} track
 * @returns {Promise<{ lines: Array<{ text: string, startTime: number }>, provider: string } | null>}
 */
async function getLyrics(track) {
  const { trackId, title = '', artist = '', album = '' } = track || {};
  if (!trackId) return null;

  const cached = getCached(trackId);
  if (cached) return cached;

  let result = null;
  try {
    result = await trySpotifyLyricsApi(trackId);
  } catch (_) {}
  if (result) {
    setCached(trackId, result);
    return result;
  }

  try {
    result = await tryLrclib(title, artist, album);
  } catch (_) {}
  if (result) {
    setCached(trackId, result);
    return result;
  }

  return null;
}

export default {
  getLyrics,
  normalizeLines,
};
