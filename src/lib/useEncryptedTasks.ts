import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { encryptData, decryptData } from './encryption';

export function useEncryptedStorage<T>(key: string, initialValue: T): [T | undefined, (value: T | ((val: T | undefined) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const item = await localforage.getItem<string>(key);
        if (item) {
          const decrypted = decryptData(item);
          if (decrypted !== null) {
            setStoredValue(decrypted);
          } else {
            setStoredValue(initialValue);
          }
        } else {
          setStoredValue(initialValue);
        }
      } catch (error) {
        console.error(error);
        setStoredValue(initialValue);
      } finally {
        setIsReady(true);
      }
    }
    init();
  }, [key]); // We rely on initialValue being static, or we'd serialize it

  const setValue = useCallback((value: T | ((val: T | undefined) => T)) => {
    setStoredValue((current) => {
      const valueToStore = value instanceof Function ? value(current) : value;
      if (valueToStore !== undefined) {
        const encrypted = encryptData(valueToStore);
        localforage.setItem(key, encrypted).catch(console.error);
      }
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue, isReady];
}
