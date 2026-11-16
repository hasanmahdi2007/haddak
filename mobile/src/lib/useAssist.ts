import { useCallback, useEffect, useRef, useState } from 'react';

import {
  api,
  ApiError,
  type AssistResponse,
  type Coordinates,
  type ProviderDetail,
  type Understood,
  type UnderstoodInput,
} from '@/api';
import { useI18n } from '@/i18n';

import { useLocation } from './location';

/** Limits of POST /assist `text` (docs/API.md). */
export const ASSIST_TEXT_MIN = 2;
export const ASSIST_TEXT_MAX = 300;
/** How many people the assistant shows as big cards; the rest are one tap away. */
export const ASSIST_TOP = 3;
/** The longest we wait for the phone's position before asking anyway (the lookup gives up at 8 s). */
const LOCATION_WAIT_MS = 9000;

/** What was asked: a sentence, or settings (a clarify option, a chosen place, "search wider"). */
export type Ask =
  | { kind: 'text'; text: string }
  | { kind: 'understood'; understood: UnderstoodInput; text: string; draft: string | null };

export type AssistPhase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; rateLimited: boolean }
  | { status: 'done'; response: AssistResponse; text: string; draft: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The settings of a plain name search, used when the assistant is unavailable. */
function nameSearch(q: string): Understood {
  return {
    category_slugs: [],
    q,
    place: null,
    radius_m: 20000,
    max_price: null,
    price_unit: null,
    price_currency: 'USD',
    open_now: false,
    sort: 'best',
  };
}

/**
 * The assistant's conversation state: ask, wait, answer. Also fetches the top three
 * profiles in the background, because search results carry no phone numbers and
 * the WhatsApp button should open at once.
 *
 * `startLoading`: the screen opens already asking (a sentence tapped on Home).
 */
export function useAssist(startLoading: boolean) {
  const i18n = useI18n();
  const location = useLocation();
  const [phase, setPhase] = useState<AssistPhase>(startLoading ? { status: 'loading' } : { status: 'idle' });
  const [details, setDetails] = useState<Record<string, ProviderDetail>>({});

  // The last question (for "Try again"), the newest request (a late answer to an
  // older one is dropped), and the position as it is now (read after waiting).
  const lastAsk = useRef<Ask | null>(null);
  const requestNo = useRef(0);
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);
  // The language is read when the request leaves, not when the screen opened: the
  // saved language loads a moment after start, and a sentence from Home is asked at once.
  const i18nRef = useRef(i18n);
  useEffect(() => {
    i18nRef.current = i18n;
  }, [i18n]);

  const run = useCallback(
    async (ask: Ask) => {
      lastAsk.current = ask;
      const mine = ++requestNo.current;

      // Wait a little while the position is still being found.
      const started = Date.now();
      while (locationRef.current.status === 'locating' && Date.now() - started < LOCATION_WAIT_MS) {
        await sleep(250);
      }
      const coords: Coordinates = locationRef.current.coords;
      const { s, f, language } = i18nRef.current;

      try {
        const base = { ...coords, lang: language };
        let response = await api.assist(
          ask.kind === 'text' ? { ...base, text: ask.text } : { ...base, understood: ask.understood },
        );
        // No AI right now: quietly search the words as a name, the way Home's name search does.
        if (response.kind === 'unavailable') {
          const q = ask.text.trim().slice(0, 60);
          const results =
            q.length >= ASSIST_TEXT_MIN
              ? await api.searchProviders({ ...coords, radius_m: 20000, q })
              : { items: [], total: 0 };
          response = {
            ...response,
            kind: 'results',
            understood: nameSearch(q),
            summary: f(s.assist.namedSummary, { q }),
            results,
          };
        }
        if (mine !== requestNo.current) return;
        // A clarify option keeps the draft written from the first sentence.
        const draft = response.whatsapp_draft ?? (ask.kind === 'understood' ? ask.draft : null);
        setPhase({ status: 'done', response, text: ask.text, draft });

        for (const item of response.results?.items.slice(0, ASSIST_TOP) ?? []) {
          api
            .getProvider(item.id, coords)
            .then((detail) => setDetails((known) => ({ ...known, [detail.id]: detail })))
            .catch(() => undefined);
        }
      } catch (cause) {
        if (mine !== requestNo.current) return;
        setPhase({ status: 'error', rateLimited: cause instanceof ApiError && cause.status === 429 });
      }
    },
    [],
  );

  /** Ask from a tap: show "Looking…" at once. */
  const ask = useCallback(
    (next: Ask) => {
      setPhase({ status: 'loading' });
      void run(next);
    },
    [run],
  );

  const retry = useCallback(() => {
    if (lastAsk.current) ask(lastAsk.current);
  }, [ask]);

  /** A profile fetched after a tap, when the background fetch has not landed yet. */
  const fetchDetail = useCallback(async (id: string): Promise<ProviderDetail> => {
    const detail = await api.getProvider(id);
    setDetails((known) => ({ ...known, [detail.id]: detail }));
    return detail;
  }, []);

  return { phase, details, run, ask, retry, fetchDetail };
}
