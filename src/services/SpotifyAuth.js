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
  'user-read-recently-played',
  'user-read-playback-position',
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify',
].join(' ');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

let activeServer = null;

function closeCallbackServer() {
  if (activeServer) {
    try {
      activeServer.close();
    } catch (_) {}
    activeServer = null;
  }
}

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

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createCodeChallenge(codeVerifier) {
  return base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
}

/**
 * Start a temporary HTTP server to receive the OAuth callback.
 * @param {{ clientId: string, redirectUri: string }} config
 * @returns {Promise<{ code: string }>}
 */
function startCallbackServer(config, expectedState = null) {
  closeCallbackServer();

  return new Promise((resolve, reject) => {
    const url = new URL(config.redirectUri);
    const port = parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80);
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
      const returnedState = reqUrl.searchParams.get('state');

      if (expectedState && returnedState !== expectedState) {
        const csrfMsg = 'Invalid state parameter (CSRF protection failed)';
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(errorHtml.replace('${escapeHtml(error || \'Unknown error\')}', escapeHtml(csrfMsg)));
        closeCallbackServer();
        reject(new Error(csrfMsg));
        return;
      }
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Connected to Spotify</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #121212;
              color: #ffffff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 80vh;
              margin: 0;
              text-align: center;
            }
            .card {
              background: #181818;
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 16px;
              padding: 40px;
              max-width: 420px;
              box-shadow: 0 12px 32px rgba(0,0,0,0.6);
            }
            h1 { color: #1db954; font-size: 24px; margin-bottom: 12px; }
            p { color: #b3b3b3; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
            .btn {
              background: #1db954;
              color: #ffffff;
              border: none;
              padding: 10px 24px;
              border-radius: 24px;
              font-weight: 600;
              cursor: pointer;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Connected Successfully!</h1>
            <p>Your Spotify account is now linked to <strong>ksync</strong>. You can close this tab and return to the dock.</p>
            <button class="btn" onclick="window.close()">Close Tab</button>
          </div>
          <script>
            setTimeout(() => { try { window.close(); } catch(_) {} }, 3000);
          </script>
        </body>
        </html>`;
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Spotify Connection Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #121212;
              color: #ffffff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 80vh;
              margin: 0;
              text-align: center;
            }
            .card {
              background: #181818;
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 16px;
              padding: 40px;
              max-width: 420px;
              box-shadow: 0 12px 32px rgba(0,0,0,0.6);
            }
            h1 { color: #ff5555; font-size: 24px; margin-bottom: 12px; }
            p { color: #b3b3b3; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Authorization Failed</h1>
            <p>${escapeHtml(error || 'Unknown error')}. You can close this tab and try again.</p>
          </div>
        </body>
        </html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(error ? errorHtml : successHtml);
      closeCallbackServer();

      if (error) {
        reject(new Error(error));
      } else if (code) {
        resolve({ code });
      } else {
        reject(new Error('No code in callback'));
      }
    });

    server.listen(port, host, () => {
      activeServer = server;
      console.log('[SpotifyAuth] Callback server listening on', config.redirectUri);
    });

    server.on('error', (err) => {
      closeCallbackServer();
      reject(err);
    });
  });
}

/**
 * Exchange authorization code for tokens.
 * @param {{ code: string, codeVerifier: string, redirectUri: string, clientId: string, clientSecret?: string }}
 */
async function exchangeCodeForTokens({ code, codeVerifier, redirectUri, clientId, clientSecret }) {
  const params = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  };
  if (clientSecret) {
    params.client_secret = clientSecret;
  }
  const body = new URLSearchParams(params);

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (clientSecret) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  }

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers,
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
 * Run full PKCE login: generate challenge, open user's default browser, start callback server, exchange code, return tokens.
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
  const state = generateRandomString(16);
  authUrl.searchParams.set('state', state);

  const serverPromise = startCallbackServer(config, state);

  // Open the URL directly in the user's default web browser with their signed-in profile!
  await shell.openExternal(authUrl.toString());

  // 3-minute timeout in case user closes the browser tab without authenticating
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      closeCallbackServer();
      reject(new Error('Login timed out. Please try again.'));
    }, 180000);
  });

  let code;
  try {
    const res = await Promise.race([serverPromise, timeoutPromise]);
    code = res.code;
  } finally {
    clearTimeout(timeoutId);
    closeCallbackServer();
  }

  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier,
    redirectUri: config.redirectUri,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
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
