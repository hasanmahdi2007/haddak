import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/api';

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiError };

type Settled<T> =
  | { key: string; status: 'ready'; data: T; error: null }
  | { key: string; status: 'error'; data: null; error: ApiError };

const LOADING = { status: 'loading', data: null, error: null } as const;

/**
 * Run an async loader whenever `deps` change. Returns the state and a `reload`.
 * Each run has a key; a result is only shown while its key is the current one,
 * so a slow earlier request can never overwrite a newer one.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: (string | number | boolean | undefined)[]) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const key = JSON.stringify([...deps.map((dep) => dep ?? null), attempt]);

  useEffect(() => {
    let current = true;
    loader()
      .then((data) => {
        if (current) setSettled({ key, status: 'ready', data, error: null });
      })
      .catch((cause: unknown) => {
        if (!current) return;
        const error =
          cause instanceof ApiError
            ? cause
            : new ApiError(0, cause instanceof Error ? cause.message : 'Unknown error');
        setSettled({ key, status: 'error', data: null, error });
      });
    return () => {
      current = false;
    };
    // The loader is rebuilt on every render; `key` says when to run it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const state: AsyncState<T> =
    settled && settled.key === key
      ? { status: settled.status, data: settled.data, error: settled.error } as AsyncState<T>
      : LOADING;
  return { ...state, reload };
}
