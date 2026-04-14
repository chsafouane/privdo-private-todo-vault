import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { encryptData, decryptData, isKeySet } from './encryption';

const isElectron = !!(window as any).electron;

async function getStorageItem(key: string, storagePath?: string | null): Promise<string | null> {
  if (isElectron && storagePath) {
    const filePath = storagePath + `/${key}.enc`;
    return await (window as any).electron.invoke('read-file', filePath);
  } else {
    return await localforage.getItem<string>(key);
  }
}

async function setStorageItem(key: string, value: string, storagePath?: string | null): Promise<void> {
  if (isElectron && storagePath) {
    const filePath = storagePath + `/${key}.enc`;
    await (window as any).electron.invoke('write-file', filePath, value);
  } else {
    await localforage.setItem(key, value);
  }
}

export function useEncryptedStorage<T>(key: string, initialValue: T, storagePath?: string | null): [T | undefined, (value: T | ((val: T | undefined) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      if (!isKeySet()) {
        setIsReady(true);
        return;
      }
      
      try {
        const item = await getStorageItem(key, storagePath);
        if (item) {
          const decrypted = decryptData(item);
          if (decrypted !== null) {
            setStoredValue(decrypted);
          } else {
            setStoredValue(initialValue); // Decrypt fail = wrong pin or bad data
          }
        } else {
          setStoredValue(initialValue);
        }
      } catch (error) {
        console.error("Storage init error", error);
        setStoredValue(initialValue);
      } finally {
        setIsReady(true);
      }
    }
    init();
  }, [key, storagePath]); 

  const setValue = useCallback((value: T | ((val: T | undefined) => T)) => {
    setStoredValue((current) => {
      const valueToStore = value instanceof Function ? value(current) : value;
      if (valueToStore !== undefined && isKeySet()) {
        const encrypted = encryptData(valueToStore);
        setStorageItem(key, encrypted, storagePath).catch(console.error);
      }
      return valueToStore;
    });
  }, [key, storagePath]);

  return [storedValue, setValue, isReady];
}
