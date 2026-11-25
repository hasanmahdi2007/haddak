/** Thrown by `withTimeout` when the time runs out first. */
export class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

/**
 * Waits for `promise`, but gives up after `ms`: rejects with a `TimeoutError`.
 * The promise itself keeps running (a JS promise cannot be cancelled); its answer is ignored.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

/** Resolves after `ms`. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
