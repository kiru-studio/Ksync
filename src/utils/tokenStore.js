/**
 * Encrypted token storage using Electron safeStorage API.
 * Must be required only from main process.
 */
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = 'tokens.json';
const BUFFER_ENCODING = 'base64';

function getTokenPath() {
  const userData = app.getPath('userData');
  const dir = path.join(userData, 'spotiffy-dock');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, TOKEN_FILE);
}

function encrypt(value) {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(value, 'utf8').toString(BUFFER_ENCODING);
  }
  return safeStorage.encryptString(value).toString(BUFFER_ENCODING);
}

function decrypt(encryptedBase64) {
  const buf = Buffer.from(encryptedBase64, BUFFER_ENCODING);
  if (!safeStorage.isEncryptionAvailable()) {
    return buf.toString('utf8');
  }
  return safeStorage.decryptString(buf);
}

/**
 * @returns {{ access_token: string, refresh_token: string, expires_at: number, user_id?: string } | null}
 */
function getTokens() {
  try {
    const tokenPath = getTokenPath();
    if (!fs.existsSync(tokenPath)) return null;
    const raw = fs.readFileSync(tokenPath, 'utf8');
    const data = JSON.parse(raw);
    return {
      access_token: decrypt(data.access_token_enc),
      refresh_token: decrypt(data.refresh_token_enc),
      expires_at: data.expires_at,
      user_id: data.user_id,
    };
  } catch (err) {
    console.error('[tokenStore] getTokens error:', err.message);
    return null;
  }
}

/**
 * @param {{ access_token: string, refresh_token: string, expires_in: number, user_id?: string }} tokens
 */
function setTokens(tokens) {
  try {
    const tokenPath = getTokenPath();
    const data = {
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      user_id: tokens.user_id || null,
    };
    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 0), 'utf8');
  } catch (err) {
    console.error('[tokenStore] setTokens error:', err.message);
    throw err;
  }
}

function clearTokens() {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
  } catch (err) {
    console.error('[tokenStore] clearTokens error:', err.message);
  }
}

function hasTokens() {
  return getTokens() !== null;
}

module.exports = {
  getTokens,
  setTokens,
  clearTokens,
  hasTokens,
};
