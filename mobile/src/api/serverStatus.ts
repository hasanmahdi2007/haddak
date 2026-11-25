import { useSyncExternalStore } from 'react';

/**
 * "Is the server slow to answer right now?", for the "Waking up the server…" line.
 *
 * The free hosting plan puts the backend to sleep after 15 quiet minutes, and the
 * first request after that takes up to a minute (docs/DEPLOY.md). The HTTP client
 * (http.ts) counts the requests that have been waiting longer than SLOW_AFTER_MS;
 * while any is, the root layout shows a small notice instead of the screen
 * looking broken. A plain module store, like src/lib/auth.ts, because the client
 * is not a component.
 */

/** After this long without an answer, a request counts as slow. */
export const SLOW_AFTER_MS = 8000;

let slowCount = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Called by the client when a request starts. Returns the function to call when
 * it ends (answered or failed): the request only counts as slow in between, and
 * only after SLOW_AFTER_MS.
 */
export function trackRequest(): () => void {
  let slow = false;
  let done = false;
  const timer = setTimeout(() => {
    if (done) return;
    slow = true;
    slowCount += 1;
    notify();
  }, SLOW_AFTER_MS);
  return () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (slow) {
      slowCount -= 1;
      notify();
    }
  };
}

/** True while at least one request has been waiting longer than SLOW_AFTER_MS. */
export function useServerWaking(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => slowCount > 0,
    () => false,
  );
}
