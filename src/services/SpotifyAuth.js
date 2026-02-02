/**
 * PKCE OAuth flow for Spotify. Must be required only from main process.
 */
const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');
const path = require('path');

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-private',
].join(' ');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += possible[bytes[i] % possible.length];
  }
  return result;
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createCodeChallenge(codeVerifier) {
  return base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
}

/**
 * Start a temporary HTTP server to receive the OAuth callback.
 * @param {{ clientId: string, redirectUri: string }} config
 * @returns {Promise<{ code: string }>}
 */
function startCallbackServer(config) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.redirectUri);
    const port = url.port || (url.protocol === 'https:' ? 443 : 80);
    const host = url.hostname;

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);
      if (reqUrl.pathname !== url.pathname) {
        res.writeHead(404);
        res.end();
        return;
      }
      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');
      const successHtml = `
        <!DOCTYPE html>
        <html><head><title>Success</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;">
          <h1>Logged in successfully</h1>
          <p>You can close this window and return to Spotiffy Dock.</p>
        </body></html>`;
      const errorHtml = `
        <!DOCTYPE html>
        <html><head><title>Error</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;">
          <h1>Authorization failed</h1>
          <p>${error || 'Unknown error'}. You can close this window.</p>
        </body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(error ? errorHtml : successHtml);
      server.close(() => {});
      if (error) {
        reject(new Error(error));
      } else if (code) {
        resolve({ code });
      } else {
        reject(new Error('No code in callback'));
      }
    });

    server.listen(port, host, () => {
      console.log('[SpotifyAuth] Callback server listening on', config.redirectUri);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Exchange authorization code for tokens (PKCE, no client secret).
 * @param {{ code: string, codeVerifier: string, redirectUri: string, clientId: string }}
 */
async function exchangeCodeForTokens({ code, codeVerifier, redirectUri, clientId }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

/**
 * Run full PKCE login: generate challenge, open browser, start callback server, exchange code, return tokens.
 * @param {{ clientId: string, redirectUri: string }} config
 * @param {{ setTokens: (t: object) => void }} tokenStore - module with setTokens
 * @returns {Promise<{ access_token: string, refresh_token: string, expires_in: number }>}
 */
async function login(config, tokenStore) {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = createCodeChallenge(codeVerifier);

  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('state', generateRandomString(16));

  const serverPromise = startCallbackServer(config);
  shell.openExternal(authUrl.toString());

  const { code } = await serverPromise;
  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier,
    redirectUri: config.redirectUri,
    clientId: config.clientId,
  });

  tokenStore.setTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  });

  return tokens;
}

module.exports = {
  login,
  SCOPES,
};
