/**
 * The order of providers in the stories row the user tapped, so the story
 * viewer can go on to the next provider (and back to the previous one).
 *
 * A row sets the list just before it opens the viewer; the viewer takes it
 * once, when it opens, and the list is cleared. Opening the viewer from
 * anywhere else (a profile, a result card) finds nothing and plays one
 * provider, as before. A small module value instead of route params keeps
 * the URL short and needs no change in the screens that host the row.
 */

let pending: string[] | null = null;

/** Called by the row right before it opens the viewer. */
export function setStoryQueue(providerIds: string[]) {
  pending = providerIds.length > 1 ? [...providerIds] : null;
}

/**
 * Called once by the viewer. Returns the row's order when the opened provider
 * is in it, otherwise null (single-provider mode).
 */
export function takeStoryQueue(openedId: string): string[] | null {
  const queue = pending;
  pending = null;
  return queue && queue.includes(openedId) ? queue : null;
}
