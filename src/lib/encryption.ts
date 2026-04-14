import CryptoJS from 'crypto-js';

// Random encryption key stored locally purely for this device.
// In a highly secure app with accounts, this would be derived from a user password.
const KEY_NAME = 'todo_crypto_key';
let encryptionKey = localStorage.getItem(KEY_NAME);

if (!encryptionKey) {
  // Generate a random 256-bit key if none exists
  encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
  localStorage.setItem(KEY_NAME, encryptionKey);
}

export function encryptData(data: any): string {
  try {
    const jsonStr = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonStr, encryptionKey as string).toString();
  } catch (error) {
    console.error('Encryption failing', error);
    return '';
  }
}

export function decryptData(cipherText: string): any {
  if (!cipherText) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, encryptionKey as string);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption failing', error);
    return null;
  }
}
