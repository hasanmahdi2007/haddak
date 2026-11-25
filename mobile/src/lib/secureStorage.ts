import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Where Supabase keeps the sign-in session (tokens) on the phone, encrypted.
 *
 * This is Supabase's documented "LargeSecureStore" pattern for Expo. The phone's
 * secure store (Android Keystore, iOS Keychain) is the safe place for secrets, but
 * it only takes about 2 KB per value and a session is larger. So each value is
 * encrypted with a fresh random AES-256 key: the key goes into the secure store,
 * and the encrypted value goes into AsyncStorage. Someone who copies the app's
 * files (a backup, a rooted phone) gets only the encrypted value.
 *
 * Sessions saved by older versions of the app (plain text) are read once and
 * written back encrypted.
 *
 * On the web there is no secure store, so the browser's storage is used as before.
 */

/** Marks an encrypted value, so a plain one from an older version can be told apart. */
const PREFIX = 'enc1:';

function encrypt(value: string): { key: string; data: string } {
  const key = getRandomBytes(32); // 256-bit AES key, new for every write
  // CTR mode with a key that is never reused, so a fixed starting counter is safe.
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const bytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  return { key: aesjs.utils.hex.fromBytes(key), data: aesjs.utils.hex.fromBytes(bytes) };
}

function decrypt(keyHex: string, dataHex: string): string {
  const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(dataHex)));
}

async function setItem(name: string, value: string): Promise<void> {
  const { key, data } = encrypt(value);
  await SecureStore.setItemAsync(name, key);
  await AsyncStorage.setItem(name, PREFIX + data);
}

async function getItem(name: string): Promise<string | null> {
  const stored = await AsyncStorage.getItem(name);
  if (stored === null) return null;
  if (!stored.startsWith(PREFIX)) {
    // A plain value from an older version: encrypt it now, once.
    await setItem(name, stored);
    return stored;
  }
  const key = await SecureStore.getItemAsync(name);
  // No key (for example the files were restored onto another phone): no session.
  if (!key) return null;
  try {
    return decrypt(key, stored.slice(PREFIX.length));
  } catch {
    return null;
  }
}

async function removeItem(name: string): Promise<void> {
  await AsyncStorage.removeItem(name);
  await SecureStore.deleteItemAsync(name);
}

/** The storage adapter given to the Supabase client (src/lib/supabase.ts). */
export const encryptedSessionStorage =
  Platform.OS === 'web' ? AsyncStorage : { getItem, setItem, removeItem };
