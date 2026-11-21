import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A random id made once per install and kept on the phone. The backend uses it
 * only to count Jarak's free AI searches per phone per day (docs/API.md,
 * "POST /assist"). It is not a secret and says nothing about the person: it is
 * random, it is sent only with Jarak requests, and reinstalling makes a new one.
 */

const STORAGE_KEY = 'haddak.install-id';

let pending: Promise<string | null> | null = null;

/** The install id, or null if the phone's storage cannot be used (the backend
 * then counts by network address only). */
export function getDeviceId(): Promise<string | null> {
  pending ??= loadOrCreate();
  return pending;
}

async function loadOrCreate(): Promise<string | null> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const created = randomUuid();
    await AsyncStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Try again next time instead of remembering the failure.
    pending = null;
    return null;
  }
}

/** A version 4 UUID. Uses the phone's secure random source when it has one; the
 * fallback is fine here because the id only needs to be unique, not secret. */
function randomUuid(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
