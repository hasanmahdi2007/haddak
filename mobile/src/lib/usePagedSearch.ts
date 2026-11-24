import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type ProviderSummary, type SearchParams } from '@/api';

/** Results asked for at a time (founder's UX rule: every growing list pages 20 at a time). */
export const PAGE_SIZE = 20;

export type PagedParams = Omit<SearchParams, 'limit' | 'offset'>;

interface PagedState {
  /** Which search these pages belong to (see `key` below). */
  key: string;
  status: 'ready' | 'error';
  items: ProviderSummary[];
  total: number;
  loadingMore: boolean;
  /** The last "load more" failed; the list stays, with a Try again under it. */
  moreError: boolean;
}

export interface PagedSearch {
  status: 'loading' | 'ready' | 'error';
  items: ProviderSummary[];
  /** Every match, not only the loaded ones (from the API's `total`). */
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: boolean;
  /** Load the next 20. Safe to call often (FlatList's onEndReached): it ignores calls while busy or done. */
  loadMore: () => void;
  /** Start again from the first page (after an error). */
  reload: () => void;
}

/** Adds a page to the list, leaving out anyone already in it (a ranking can shift between pages). */
function merge(current: ProviderSummary[], page: ProviderSummary[]): ProviderSummary[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...page.filter((item) => !seen.has(item.id))];
}

/**
 * GET /providers/search, 20 at a time.
 *
 * `params` null means "not yet" (the position is still being found): the state stays loading.
 * Any change in `params` starts over from the first page; a page that arrives for an older
 * search is dropped, so a slow answer can never mix two searches in one list.
 */
export function usePagedSearch(params: PagedParams | null): PagedSearch {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PagedState | null>(null);
  // The offset being loaded right now. FlatList can call onEndReached twice before the
  // screen re-renders; this stops the second call from asking for the same page.
  const inFlight = useRef<string | null>(null);
  // The search as text: a new object with the same values is the same search.
  const key = params === null ? '' : JSON.stringify([params, attempt]);
  useEffect(() => {
    if (params === null) return undefined;
    let current = true;
    api
      .searchProviders({ ...params, limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (current) {
          setState({ key, status: 'ready', items: merge([], page.items), total: page.total, loadingMore: false, moreError: false });
        }
      })
      .catch(() => {
        if (current) setState({ key, status: 'error', items: [], total: 0, loadingMore: false, moreError: false });
      });
    return () => {
      current = false;
    };
    // `key` holds everything in `params`; the object itself is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Only the state of the current search counts; anything else means its first page is on the way.
  const mine = state !== null && state.key === key ? state : null;

  // A plain function, rebuilt each render, so it always sees this render's search.
  const loadMore = () => {
    const forKey = key;
    const forParams = params;
    if (!forParams || !mine || mine.status !== 'ready' || mine.loadingMore || mine.items.length >= mine.total) return;
    const request = `${forKey}@${mine.items.length}`;
    if (inFlight.current === request) return;
    inFlight.current = request;
    setState({ ...mine, loadingMore: true, moreError: false });
    api
      .searchProviders({ ...forParams, limit: PAGE_SIZE, offset: mine.items.length })
      .then((page) => {
        inFlight.current = null;
        setState((now) => {
          if (!now || now.key !== forKey) return now;
          const items = merge(now.items, page.items);
          // An empty page means the list is complete even if `total` said otherwise:
          // stop here instead of asking again and again.
          const total = page.items.length === 0 ? items.length : page.total;
          return { ...now, items, total, loadingMore: false };
        });
      })
      .catch(() => {
        inFlight.current = null;
        setState((now) => (now && now.key === forKey ? { ...now, loadingMore: false, moreError: true } : now));
      });
  };

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (!mine) {
    return { status: 'loading', items: [], total: 0, hasMore: false, loadingMore: false, moreError: false, loadMore, reload };
  }
  return {
    status: mine.status,
    items: mine.items,
    total: mine.total,
    hasMore: mine.status === 'ready' && mine.items.length < mine.total,
    loadingMore: mine.loadingMore,
    moreError: mine.moreError,
    loadMore,
    reload,
  };
}
