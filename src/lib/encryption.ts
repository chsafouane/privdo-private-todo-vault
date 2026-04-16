import CryptoJS from 'crypto-js';

const ITERATIONS = 600000;
const KEY_SIZE = 256 / 32;          // AES-256 (new standard)
const LEGACY_KEY_SIZE = 128 / 32;   // AES-128 (old standard)
const FORMAT_VERSION = 2;

let encryptionKey: string | null = null;
let migrationKey: string | null = null;  // 128-bit / 600k iter key for backward compat
let legacyKey: string | null = null;     // 128-bit / 1000 iter key for very old data

function getSalt(): string {
  let salt = localStorage.getItem('encryption-salt');
  if (!salt) {
    salt = CryptoJS.lib.WordArray.random(16).toString();
    localStorage.setItem('encryption-salt', salt);
  }
  return salt;
}

/** Restore a previously persisted salt (e.g. from Electron config) into localStorage. */
export function restoreSalt(salt: string): void {
  localStorage.setItem('encryption-salt', salt);
}

/** Return the current salt value so it can be persisted externally. */
export function getCurrentSalt(): string {
  return getSalt();
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Native(pin: string, salt: Uint8Array, iterations: number, keyLengthBits: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    keyLengthBits
  );
  return bytesToHex(new Uint8Array(derived));
}

async function deriveKey(pin: string, salt: string): Promise<string> {
  return pbkdf2Native(pin, hexToBytes(salt), ITERATIONS, KEY_SIZE * 32);
}

async function deriveMigrationKey(pin: string, salt: string): Promise<string> {
  return pbkdf2Native(pin, hexToBytes(salt), ITERATIONS, LEGACY_KEY_SIZE * 32);
}

// Legacy key uses a hard-coded salt and only 1000 iterations (insecure).
// Kept solely for migrating very old encrypted data to the current scheme.
async function deriveLegacyKey(pin: string): Promise<string> {
  const salt = new TextEncoder().encode('local-todo-manager-salt');
  return pbkdf2Native(pin, salt, 1000, LEGACY_KEY_SIZE * 32);
}

// Derive a separate HMAC key for encrypt-then-MAC authentication
function deriveHmacKey(keyHex: string): CryptoJS.lib.WordArray {
  return CryptoJS.SHA256(
    CryptoJS.enc.Hex.parse(keyHex).concat(CryptoJS.enc.Utf8.parse(':hmac-auth'))
  );
}

// Authenticated encryption: AES-256-CBC with HMAC-SHA256 (encrypt-then-MAC)
function authenticatedEncrypt(plaintext: string, keyHex: string): string {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const hmacKey = deriveHmacKey(keyHex);
  const ivHex = iv.toString();
  const ctHex = encrypted.ciphertext.toString();
  const mac = CryptoJS.HmacSHA256(ivHex + ctHex, hmacKey).toString();
  return JSON.stringify({ v: FORMAT_VERSION, iv: ivHex, ct: ctHex, mac });
}

// Authenticated decryption with MAC verification
function authenticatedDecrypt(cipherText: string, keyHex: string): string | null {
  try {
    const parsed = JSON.parse(cipherText);
    if (parsed.v !== FORMAT_VERSION) return null;
    const hmacKey = deriveHmacKey(keyHex);
    const expectedMac = CryptoJS.HmacSHA256(parsed.iv + parsed.ct, hmacKey).toString();
    if (!constantTimeEqual(expectedMac, parsed.mac)) return null;
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.enc.Hex.parse(parsed.iv);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(parsed.ct),
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8) || null;
  } catch {
    return null;
  }
}

// Legacy decryption using CryptoJS passphrase mode (backward compatibility only)
function legacyDecryptPassphraseMode(cipherText: string, keyHex: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, keyHex);
    return bytes.toString(CryptoJS.enc.Utf8) || null;
  } catch {
    return null;
  }
}

export async function setEncryptionKeyFromPin(pin: string) {
  const salt = getSalt();
  // Derive all keys in parallel using native Web Crypto API
  const [primary, migration, legacy] = await Promise.all([
    deriveKey(pin, salt),
    deriveMigrationKey(pin, salt),
    deriveLegacyKey(pin),
  ]);
  encryptionKey = primary;
  migrationKey = migration;
  legacyKey = legacy;
}

export function isKeySet(): boolean {
  return encryptionKey !== null;
}

export function clearEncryptionKey() {
  encryptionKey = null;
  migrationKey = null;
  legacyKey = null;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Always compares the longer of the two lengths to avoid leaking length information.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // non-zero if lengths differ
  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = getSalt();
  return pbkdf2Native(pin, hexToBytes(salt), ITERATIONS, 256);
}

export function legacyHashPin(pin: string): string {
  return CryptoJS.SHA256(pin).toString();
}

export async function encryptDataWithPin(data: any, pin: string): Promise<string> {
  const exportSalt = CryptoJS.lib.WordArray.random(16).toString();
  const tempKey = await deriveKey(pin, exportSalt);
  try {
    const jsonStr = JSON.stringify(data);
    const key = CryptoJS.enc.Hex.parse(tempKey);
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(jsonStr, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const hmacKey = deriveHmacKey(tempKey);
    const ivHex = iv.toString();
    const ctHex = encrypted.ciphertext.toString();
    const mac = CryptoJS.HmacSHA256(ivHex + ctHex, hmacKey).toString();
    return JSON.stringify({ salt: exportSalt, v: FORMAT_VERSION, iv: ivHex, ct: ctHex, mac });
  } catch {
    return '';
  }
}

export async function decryptDataWithPin(cipherText: string, pin: string): Promise<any> {
  if (!cipherText) return null;
  try {
    let parsed: any;
    try {
      parsed = JSON.parse(cipherText);
    } catch {
      // Legacy format without JSON wrapper — try 128-bit / 1000 iter key (passphrase mode)
      const tempKey = await deriveLegacyKey(pin);
      const result = legacyDecryptPassphraseMode(cipherText, tempKey);
      if (!result) return null;
      return JSON.parse(result);
    }

    // v2 authenticated format with per-export salt
    if (parsed.v === FORMAT_VERSION && parsed.salt && parsed.iv && parsed.ct && parsed.mac) {
      const tempKey = await deriveKey(pin, parsed.salt);
      const hmacKey = deriveHmacKey(tempKey);
      const expectedMac = CryptoJS.HmacSHA256(parsed.iv + parsed.ct, hmacKey).toString();
      if (!constantTimeEqual(expectedMac, parsed.mac)) return null;
      const key = CryptoJS.enc.Hex.parse(tempKey);
      const iv = CryptoJS.enc.Hex.parse(parsed.iv);
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Hex.parse(parsed.ct),
      });
      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      if (result) return JSON.parse(result);
      return null;
    }

    // Legacy JSON format: { salt, data } with passphrase-mode encryption
    const salt: string = parsed.salt;
    const encData: string = parsed.data;

    // Try 256-bit key first (passphrase mode)
    try {
      const newKey = await deriveKey(pin, salt);
      const result = legacyDecryptPassphraseMode(encData, newKey);
      if (result) return JSON.parse(result);
    } catch { /* fall through */ }

    // Try 128-bit key with same salt + iterations (passphrase mode)
    const oldKey = await deriveMigrationKey(pin, salt);
    const result = legacyDecryptPassphraseMode(encData, oldKey);
    if (!result) return null;
    return JSON.parse(result);
  } catch {
    return null;
  }
}

export function encryptData(data: any): string {
  if (!encryptionKey) throw new Error('Encryption key not set');
  try {
    const jsonStr = JSON.stringify(data);
    return authenticatedEncrypt(jsonStr, encryptionKey);
  } catch {
    throw new Error('Encryption failed');
  }
}

export function decryptData(cipherText: string): any {
  if (!encryptionKey) throw new Error('Encryption key not set');
  if (!cipherText) return null;

  // Try v2 authenticated format first
  const v2Result = authenticatedDecrypt(cipherText, encryptionKey);
  if (v2Result) {
    try { return JSON.parse(v2Result); } catch { /* fall through */ }
  }

  // Legacy: try current 256-bit key (passphrase mode)
  {
    const result = legacyDecryptPassphraseMode(cipherText, encryptionKey);
    if (result) {
      try { return JSON.parse(result); } catch { /* fall through */ }
    }
  }

  // Legacy: try migration key (128-bit / 600k iterations, passphrase mode)
  if (migrationKey) {
    const result = legacyDecryptPassphraseMode(cipherText, migrationKey);
    if (result) {
      try { return JSON.parse(result); } catch { /* fall through */ }
    }
  }

  // Legacy: try legacy key (128-bit / 1000 iterations, passphrase mode)
  if (legacyKey) {
    const result = legacyDecryptPassphraseMode(cipherText, legacyKey);
    if (result) {
      try { return JSON.parse(result); } catch { /* ignore */ }
    }
  }

  return null;
}
