/**
 * Encrypted token storage using Electron safeStorage API.
 * Must be required only from main process.
 */
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = 'tokens.json';
const BUFFER_ENCODING = 'base64';

function getCandidatePaths() {
  const paths = [];
  try {
    const userData = app.getPath('userData');
    paths.push(path.join(userData, TOKEN_FILE));
    paths.push(path.join(userData, 'spotiffy-dock', TOKEN_FILE));
  } catch (_) {}
  try {
    const appData = app.getPath('appData');
    paths.push(path.join(appData, 'ksync', TOKEN_FILE));
    paths.push(path.join(appData, 'ksync', 'spotiffy-dock', TOKEN_FILE));
    paths.push(path.join(appData, 'Electron', TOKEN_FILE));
    paths.push(path.join(appData, 'Electron', 'spotiffy-dock', TOKEN_FILE));
  } catch (_) {}
  return paths;
}

function findExistingTokenPath() {
  for (const p of getCandidatePaths()) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

function getTokenPath() {
  const existing = findExistingTokenPath();
  if (existing) return existing;
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
    const tokenPath = findExistingTokenPath() || getTokenPath();
    if (!tokenPath || !fs.existsSync(tokenPath)) return null;
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
    const primaryPath = getTokenPath();
    const data = {
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      user_id: tokens.user_id || null,
    };
    const jsonStr = JSON.stringify(data, null, 0);
    fs.writeFileSync(primaryPath, jsonStr, 'utf8');
    
    // Also mirror to root userData to be safe
    try {
      const altPath = path.join(app.getPath('userData'), TOKEN_FILE);
      if (altPath !== primaryPath) fs.writeFileSync(altPath, jsonStr, 'utf8');
    } catch (_) {}
  } catch (err) {
    console.error('[tokenStore] setTokens error:', err.message);
    throw err;
  }
}

function clearTokens() {
  try {
    for (const p of getCandidatePaths()) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (_) {}
      }
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
