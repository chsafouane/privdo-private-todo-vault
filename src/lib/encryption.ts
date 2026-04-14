import CryptoJS from 'crypto-js';

const ITERATIONS = 600000;
const KEY_SIZE = 128 / 32;

let encryptionKey: string | null = null;
let legacyKey: string | null = null;

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

function deriveLegacyKey(pin: string): string {
  const salt = CryptoJS.enc.Utf8.parse('local-todo-manager-salt');
  return CryptoJS.PBKDF2(pin, salt, { keySize: KEY_SIZE, iterations: 1000 }).toString();
}

export function setEncryptionKeyFromPin(pin: string) {
  // Check if this user had data before the salt migration
  const hadSaltBefore = !!localStorage.getItem('encryption-salt');
  encryptionKey = deriveKey(pin, getSalt());
  // If no salt existed before this call, user may have legacy-encrypted data
  if (!hadSaltBefore) {
    legacyKey = deriveLegacyKey(pin);
  }
}

export function isKeySet(): boolean {
  return encryptionKey !== null;
}

export function clearEncryptionKey() {
  encryptionKey = null;
  legacyKey = null;
}

export function hashPin(pin: string): string {
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
      // Legacy format without salt
      const legacySalt = CryptoJS.enc.Utf8.parse('local-todo-manager-salt');
      const tempKey = CryptoJS.PBKDF2(pin, legacySalt, { keySize: KEY_SIZE, iterations: 1000 }).toString();
      const bytes = CryptoJS.AES.decrypt(cipherText, tempKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) return null;
      return JSON.parse(decryptedString);
    }
    const tempKey = deriveKey(pin, salt);
    const bytes = CryptoJS.AES.decrypt(encData, tempKey);
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
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, encryptionKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (decryptedString) return JSON.parse(decryptedString);
  } catch { /* fall through to legacy */ }
  
  // Try legacy key for backward compatibility
  if (legacyKey) {
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, legacyKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedString) return JSON.parse(decryptedString);
    } catch { /* ignore */ }
  }

  return null;
}
