import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { encryptedSessionStorage } from './secureStorage';

/**
 * The Supabase client, used only for signing in (an emailed link, or a 6-digit code).
 * Everything else goes through the FastAPI backend (src/api).
 *
 * Both values come from mobile/.env (EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_ANON_KEY). The anon key is meant to be public: it only
 * lets the app ask Supabase Auth for a sign-in email. When either is missing, `supabase`
 * is null and the sign-in screen says sign-in is not set up.
 *
 * No URL polyfill: current Supabase docs for Expo create the client without one.
 */
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

// Development only: lets a test replace Supabase's network calls (see the end of
// this file), so sign-in screens can be tried without sending real emails.
let devFetch: typeof fetch | null = null;
// Looked up on every call, not once, so the replacement above takes effect.
const lazyFetch: typeof fetch = (input, init) => (devFetch ?? fetch)(input, init);

function create(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey, {
      auth: {
        // The session (tokens) is kept on the phone, encrypted (src/lib/secureStorage.ts),
        // so the user stays signed in.
        storage: encryptedSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        // PKCE: the emailed link brings back a one-time `code`, and only this phone
        // can trade it for a session (the secret half, the "code verifier", waits
        // in the storage above). The auth-callback screen does the trade.
        flowType: 'pkce',
        // That screen reads the link itself, so the client must not (it would on the web).
        detectSessionInUrl: false,
      },
      global: { fetch: lazyFetch },
    });
  } catch {
    // A malformed URL: behave as "not configured" instead of crashing the app.
    return null;
  }
}

export const supabase = create();

// On a phone, refresh the token only while the app is in front (Supabase's advice
// for React Native). On the web the client does this by itself.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

if (__DEV__) {
  (globalThis as { __haddakAuthFetch?: (stub: typeof fetch | null) => void }).__haddakAuthFetch = (stub) => {
    devFetch = stub;
  };
}
