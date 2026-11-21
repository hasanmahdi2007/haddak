import type { Session } from '@supabase/supabase-js';
import {
  isAuthApiError,
  isAuthPKCECodeVerifierMissingError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useSyncExternalStore } from 'react';

import { supabase } from './supabase';

/**
 * Who is signed in, and the one gate every account-only action goes through.
 *
 * Signing in is Supabase Auth by email, no passwords. The email holds a link that
 * opens the app on the auth-callback screen (src/app/auth-callback.tsx), or, once
 * custom email templates are set up, a 6-digit code typed on the sign-in screen.
 * The state lives in this module (not in a React context) so the API client,
 * which is not a component, can read the token too. Screens read it with
 * `useAuth()`. `<AuthProvider>` in the root layout starts it.
 *
 * Anything that needs an account calls `requireSignIn()` first:
 *
 *   if (!requireSignIn(() => follow())) return;
 *
 * Signed in: it answers true. Signed out: it opens the sign-in screen and answers
 * false; after a successful sign-in the screen closes (the user is back where
 * they were) and the function passed in runs, so the action they wanted happens.
 */

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  /** Null for the development token, which carries no email. */
  email: string | null;
  userId: string | null;
  /** Signed in with EXPO_PUBLIC_DEV_TOKEN (development builds only). */
  dev: boolean;
}

/** False when the app was built without the Supabase URL and key. */
export const signInConfigured = supabase !== null;

// ---------------------------------------------------------------------------
// Development token. `backend/scripts/dev_token.py` prints a token the local
// backend accepts when ALLOW_DEV_TOKENS=true. Put it in
// EXPO_PUBLIC_DEV_TOKEN to be signed in without an email. `__DEV__` is false in
// store builds, so there this is always empty, whatever the environment says.
const DEV_TOKEN = __DEV__ ? (process.env.EXPO_PUBLIC_DEV_TOKEN ?? '').trim() : '';
let devTokenActive = DEV_TOKEN.length > 0;

/** Reads the user id (`sub`) out of a JWT without checking it; the backend checks it. */
function tokenSubject(token: string): string | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))) as {
      sub?: unknown;
    };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The store: one value and the components listening to it.

let state: AuthState = { status: 'loading', email: null, userId: null, dev: false };
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function fromSession(session: Session | null): AuthState {
  return session
    ? { status: 'signedIn', email: session.user.email ?? null, userId: session.user.id, dev: false }
    : { status: 'signedOut', email: null, userId: null, dev: false };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current sign-in state; the component re-renders when it changes. */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

let started = false;

/** Reads the saved session once and follows every change after it. */
function start() {
  if (started) return;
  started = true;
  if (devTokenActive) {
    setState({ status: 'signedIn', email: null, userId: tokenSubject(DEV_TOKEN), dev: true });
    return;
  }
  if (!supabase) {
    setState(fromSession(null));
    return;
  }
  supabase.auth
    .getSession()
    .then(({ data }) => {
      if (!devTokenActive) setState(fromSession(data.session));
    })
    .catch(() => setState(fromSession(null)));
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!devTokenActive) setState(fromSession(session));
  });
}

/** Sits in the root layout and starts the store. Draws nothing of its own. */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(start, []);
  return children;
}

/**
 * The token for `Authorization: Bearer ...`, or null when signed out.
 * Supabase hands back a fresh one when the old one is about to expire.
 */
export async function getAccessToken(): Promise<string | null> {
  if (devTokenActive) return DEV_TOKEN;
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Signs out on this phone only. Works offline. */
export async function signOut(): Promise<void> {
  if (devTokenActive) {
    devTokenActive = false;
    setState(fromSession(null));
    return;
  }
  if (!supabase) return;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    setState(fromSession(null));
  }
}

/** The backend refused the token (401): the session is no good, so drop it. */
export function handleUnauthorized() {
  if (state.status === 'signedIn') void signOut();
}

// ---------------------------------------------------------------------------
// The gate.

let afterSignIn: (() => void) | null = null;

/** True when signed in. Otherwise opens sign-in and runs `then` once it succeeds. */
export function requireSignIn(then?: () => void): boolean {
  if (state.status === 'signedIn') return true;
  afterSignIn = then ?? null;
  router.push('/sign-in');
  return false;
}

/** Called by the sign-in screen when the user is in: close it and finish what they started. */
export function finishSignIn() {
  const next = afterSignIn;
  afterSignIn = null;
  if (router.canGoBack()) router.back();
  else router.replace('/');
  // After the screen has closed, so the action happens where the user started it.
  if (next) setTimeout(next, 0);
}

/** The user closed sign-in without finishing: forget the action they wanted. */
export function cancelSignIn() {
  afterSignIn = null;
}

// ---------------------------------------------------------------------------
// Sending and checking the code.

export type AuthFailure =
  | 'notConfigured'
  | 'invalidEmail'
  | 'notAllowed'
  | 'wrongCode'
  | 'expired'
  | 'rateLimited'
  | 'offline'
  /** The emailed link was used already, or is too old. */
  | 'linkExpired'
  /** The link was opened on another phone (or app) than the one that asked for it. */
  | 'otherDevice'
  /** "Sign in" was chosen, but this email has no account yet. */
  | 'noAccount'
  | 'other';

export type AuthResult = { ok: true } | { ok: false; failure: AuthFailure; retryAfterS: number | null };

/** Supabase's default life of an email code (Auth settings, "Email OTP expiration"). */
const CODE_LIFETIME_MS = 3600 * 1000;
let codeSentAt = 0;

function fail(failure: AuthFailure, retryAfterS: number | null = null): AuthResult {
  return { ok: false, failure, retryAfterS };
}

/** Turns a Supabase error into one of the cases the screen has words for. */
function toFailure(error: unknown, step: 'send' | 'verify'): AuthResult {
  if (isAuthRetryableFetchError(error)) return fail('offline');
  if (isAuthApiError(error)) {
    // "For security purposes, you can only request this after 42 seconds."
    const seconds = /(\d+)\s*second/.exec(error.message);
    if (error.status === 429 || error.code?.startsWith('over_')) {
      return fail('rateLimited', seconds ? Number(seconds[1]) : null);
    }
    // Supabase's built-in mailer only writes to the project's team until custom SMTP is set up.
    if (error.code === 'email_address_not_authorized') return fail('notAllowed');
    // Asked to sign in (not to create an account) with an email Supabase doesn't know:
    // "Signups not allowed for otp".
    if (step === 'send' && (error.code === 'otp_disabled' || /signups? not allowed/i.test(error.message))) {
      return fail('noAccount');
    }
    if (step === 'send' && (error.code === 'email_address_invalid' || error.code === 'validation_failed')) {
      return fail('invalidEmail');
    }
    if (step === 'verify' && (error.code === 'otp_expired' || error.status === 403 || error.status === 400)) {
      // Supabase gives one answer for "wrong" and "expired". Past the code's life
      // it must be the second; before it, most likely a typo or an older email.
      return fail(codeSentAt > 0 && Date.now() - codeSentAt > CODE_LIFETIME_MS ? 'expired' : 'wrongCode');
    }
  }
  if (error instanceof TypeError) return fail('offline');
  return fail('other');
}

/** The app's own link back: `exp://<computer>:8081/--/auth-callback` in Expo Go, `haddak://auth-callback` in a real build. */
function appCallbackUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  // Linking.createURL can answer haddak:// inside Expo Go, which Expo Go cannot open,
  // so Expo Go's own link is built here from the computer's address.
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === 'expo';
  if (inExpoGo && hostUri) return `exp://${hostUri}/--/auth-callback`;
  return Linking.createURL('auth-callback');
}

/**
 * Where the link in the email sends the user. Email links open in a browser, and a
 * browser shows an empty page for an app link, so when the backend is set we go through
 * its small `/auth/open` page, which passes the code on to the app. Supabase only follows
 * it if it matches the project's allowed redirect URLs (Auth -> URL Configuration).
 */
export function signInRedirectUrl(): string {
  const app = appCallbackUrl();
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!apiUrl) return app;
  return `${apiUrl}/auth/open?app=${encodeURIComponent(app)}`;
}

export type AuthMode = 'signUp' | 'signIn';

/**
 * Step 1: email the user a sign-in link (and a 6-digit code, if the email template
 * shows one). "signUp" makes an account for a new address (an existing one simply
 * signs in); "signIn" only works for an address that already has an account.
 */
export async function sendCode(email: string, mode: AuthMode = 'signUp'): Promise<AuthResult> {
  if (!supabase) return fail('notConfigured');
  try {
    const redirect = signInRedirectUrl();
    // Shown in the Expo terminal, to see which link the email will carry.
    if (__DEV__) console.log('[Haddak auth] email link returns to', redirect);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: mode === 'signUp', emailRedirectTo: redirect },
    });
    if (error) return toFailure(error, 'send');
    codeSentAt = Date.now();
    return { ok: true };
  } catch (error) {
    return toFailure(error, 'send');
  }
}

/** Step 2: check the code. On success Supabase stores the session and the store updates. */
export async function verifyCode(email: string, code: string): Promise<AuthResult> {
  if (!supabase) return fail('notConfigured');
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) return toFailure(error, 'verify');
    return { ok: true };
  } catch (error) {
    return toFailure(error, 'verify');
  }
}

// ---------------------------------------------------------------------------
// Coming back from the link in the email.

/** What the link brought back, read from its query (`?code=`) or its `#fragment`. */
export interface SignInLink {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  errorCode?: string;
  errorDescription?: string;
}

// React may run the callback screen's effect twice; a code works only once.
const codesTried = new Map<string, Promise<AuthResult>>();

/** Turns the link into a session. On success the store turns "signed in". */
export function signInWithLink(link: SignInLink): Promise<AuthResult> {
  const key = link.code ?? link.accessToken ?? link.errorCode ?? link.errorDescription ?? '';
  const earlier = codesTried.get(key);
  if (earlier) return earlier;
  const attempt = exchangeLink(link);
  codesTried.set(key, attempt);
  // Offline, the code was never used, so a later try may still work.
  void attempt.then((result) => {
    if (!result.ok && result.failure === 'offline') codesTried.delete(key);
  });
  return attempt;
}

async function exchangeLink(link: SignInLink): Promise<AuthResult> {
  if (!supabase) return fail('notConfigured');
  // Supabase sends the user back with an error instead of a code when the link
  // was already used or is too old ("otp_expired": "Email link is invalid or has expired").
  if (link.errorCode || link.errorDescription) {
    const expired = link.errorCode === 'otp_expired' || /expired|invalid/i.test(link.errorDescription ?? '');
    return fail(expired ? 'linkExpired' : 'other');
  }
  try {
    if (link.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error) return linkFailure(error);
      return { ok: true };
    }
    // Older "implicit" links carry the tokens themselves in the #fragment.
    if (link.accessToken && link.refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      if (error) return linkFailure(error);
      return { ok: true };
    }
    return fail('linkExpired');
  } catch (error) {
    return linkFailure(error);
  }
}

function linkFailure(error: unknown): AuthResult {
  // The secret half of the code is kept only on the phone that asked for the email.
  if (isAuthPKCECodeVerifierMissingError(error)) return fail('otherDevice');
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return fail('offline');
  if (isAuthApiError(error) && (error.status === 400 || error.status === 403 || error.status === 404)) {
    return fail('linkExpired');
  }
  return fail('other');
}
