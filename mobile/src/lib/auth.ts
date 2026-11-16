/**
 * Sign-in does not exist yet. Anything that needs an account (Follow, and later
 * reviews and posting) calls `requireSignIn()` first:
 *
 *   if (!requireSignIn()) return;
 *
 * For now it always answers false and shows a small "Sign-in is coming soon"
 * notice (drawn by `SignInNotice`, which sits in the root layout). When sign-in
 * is built, this one function is the place to open the sign-in screen instead.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Used by SignInNotice to hear about each call. Returns the function that stops listening. */
export function onSignInRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the user is signed in. Today: never, and the user is told sign-in is coming. */
export function requireSignIn(): boolean {
  listeners.forEach((listener) => listener());
  return false;
}
