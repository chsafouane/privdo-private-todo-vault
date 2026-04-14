import CryptoJS from 'crypto-js';

let encryptionKey: string | null = null;

export function setEncryptionKeyFromPin(pin: string) {
  // Use a simple static salt to derive a more complex key from the PIN
  const salt = CryptoJS.enc.Utf8.parse('local-todo-manager-salt');
  const key128Bits = CryptoJS.PBKDF2(pin, salt, {
    keySize: 128 / 32,
    iterations: 1000
  });
  encryptionKey = key128Bits.toString();
}

export function isKeySet(): boolean {
  return encryptionKey !== null;
}

export function clearEncryptionKey() {
  encryptionKey = null;
}

export function hashPin(pin: string): string {
  return CryptoJS.SHA256(pin).toString();
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
    if (!decryptedString) return null;
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption failing', error);
    return null; // Indicates wrong PIN or corrupted data
  }
}
