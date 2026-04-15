import CryptoJS from 'crypto-js';

const ITERATIONS = 600000;
const KEY_SIZE = 256 / 32;          // AES-256 (new standard)
const LEGACY_KEY_SIZE = 128 / 32;   // AES-128 (old standard)

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

function deriveKey(pin: string, salt: string): string {
  const saltWords = CryptoJS.enc.Hex.parse(salt);
  return CryptoJS.PBKDF2(pin, saltWords, { keySize: KEY_SIZE, iterations: ITERATIONS }).toString();
}

function deriveMigrationKey(pin: string, salt: string): string {
  const saltWords = CryptoJS.enc.Hex.parse(salt);
  return CryptoJS.PBKDF2(pin, saltWords, { keySize: LEGACY_KEY_SIZE, iterations: ITERATIONS }).toString();
}

// Legacy key uses a hard-coded salt and only 1000 iterations (insecure).
// Kept solely for migrating very old encrypted data to the current scheme.
function deriveLegacyKey(pin: string): string {
  const salt = CryptoJS.enc.Utf8.parse('local-todo-manager-salt');
  return CryptoJS.PBKDF2(pin, salt, { keySize: LEGACY_KEY_SIZE, iterations: 1000 }).toString();
}

export function setEncryptionKeyFromPin(pin: string) {
  const salt = getSalt();
  encryptionKey = deriveKey(pin, salt);
  // Migration key: old 128-bit key with current salt + iterations
  migrationKey = deriveMigrationKey(pin, salt);
  // Always derive legacy key so very old data (128-bit / 1000 iter) can be decrypted
  // regardless of whether the user went through intermediate migration steps
  legacyKey = deriveLegacyKey(pin);
}

export function isKeySet(): boolean {
  return encryptionKey !== null;
}

export function clearEncryptionKey() {
  encryptionKey = null;
  migrationKey = null;
  legacyKey = null;
}

export function hashPin(pin: string): string {
  const salt = getSalt();
  return CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), { keySize: 8, iterations: ITERATIONS }).toString();
}

export function legacyHashPin(pin: string): string {
  return CryptoJS.SHA256(pin).toString();
}

export function encryptDataWithPin(data: any, pin: string): string {
  const exportSalt = CryptoJS.lib.WordArray.random(16).toString();
  const tempKey = deriveKey(pin, exportSalt);
  try {
    const jsonStr = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonStr, tempKey).toString();
    return JSON.stringify({ salt: exportSalt, data: encrypted });
  } catch (error) {
    console.error('Encryption failing', error);
    return '';
  }
}

export function decryptDataWithPin(cipherText: string, pin: string): any {
  if (!cipherText) return null;
  try {
    let salt: string;
    let encData: string;
    try {
      const parsed = JSON.parse(cipherText);
      salt = parsed.salt;
      encData = parsed.data;
    } catch {
      // Legacy format without salt — try 128-bit / 1000 iter key
      const legacySalt = CryptoJS.enc.Utf8.parse('local-todo-manager-salt');
      const tempKey = CryptoJS.PBKDF2(pin, legacySalt, { keySize: LEGACY_KEY_SIZE, iterations: 1000 }).toString();
      const bytes = CryptoJS.AES.decrypt(cipherText, tempKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) return null;
      return JSON.parse(decryptedString);
    }

    // Try new 256-bit key first
    try {
      const newKey = deriveKey(pin, salt);
      const bytes = CryptoJS.AES.decrypt(encData, newKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedString) return JSON.parse(decryptedString);
    } catch { /* fall through */ }

    // Try old 128-bit key with same salt + iterations
    const oldKey = CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), { keySize: LEGACY_KEY_SIZE, iterations: ITERATIONS }).toString();
    const bytes = CryptoJS.AES.decrypt(encData, oldKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) return null;
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption failing', error);
    return null;
  }
}

export function encryptData(data: any): string {
  if (!encryptionKey) throw new Error('Encryption key not set');
  try {
    const jsonStr = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonStr, encryptionKey).toString();
  } catch (error) {
    console.error('Encryption failing', error);
    return '';
  }
}

export function decryptData(cipherText: string): any {
  if (!encryptionKey) throw new Error('Encryption key not set');
  if (!cipherText) return null;

  // Try current 256-bit key first
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, encryptionKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (decryptedString) return JSON.parse(decryptedString);
  } catch { /* fall through */ }

  // Try migration key (128-bit / 600k iterations)
  if (migrationKey) {
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, migrationKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedString) return JSON.parse(decryptedString);
    } catch { /* fall through */ }
  }

  // Try legacy key (128-bit / 1000 iterations)
  if (legacyKey) {
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, legacyKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedString) return JSON.parse(decryptedString);
    } catch { /* ignore */ }
  }

  return null;
}
