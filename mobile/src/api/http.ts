import { wait, withTimeout } from '@/lib/timeout';

import {
  ApiError,
  type AssistRequest,
  type AssistResponse,
  type AvailableHours,
  type Banner,
  type BannerInput,
  type Category,
  type Claim,
  type ClaimInput,
  type ContactEventType,
  type Coordinates,
  type FollowingParams,
  type HaddakApi,
  type HealthResponse,
  type HireAnswer,
  type HireCheck,
  type NearbyStoriesParams,
  type OwnProvider,
  type Page,
  type ProviderCreateInput,
  type ProviderDetail,
  type ProviderStats,
  type ProviderSummary,
  type ProviderUpdateInput,
  type ReportInput,
  type Review,
  type ReviewInput,
  type ReviewListParams,
  type SearchParams,
  type Story,
  type StoryGroup,
  type StoryInput,
  type SuggestionInput,
} from './types';
import { trackRequest } from './serverStatus';

type Query = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Send the login token; 401 if the user is signed out. */
  auth?: boolean;
  /** Send the install id (X-Haddak-Device), for Jarak's free daily allowance. */
  device?: boolean;
  /** How long one try may take, counted from the start (getting the token included). */
  timeoutMs?: number;
  /**
   * Try again when the server cannot be reached. On by default for GET only:
   * a GET changes nothing, so sending it twice is harmless. A POST is never
   * repeated by itself, because the first one may have reached the server.
   */
  retry?: boolean;
  /** Not counted for the "Waking up the server…" notice (the background warm-up). */
  quiet?: boolean;
}

/** One normal try. */
const TIMEOUT_MS = 15_000;
/** One try of a GET that will be repeated: long, because a waking server answers late. */
const RETRY_TRY_MS = 30_000;
/** All tries of one GET together: the free server can take about a minute to wake up. */
const RETRY_BUDGET_MS = 60_000;
/** Pauses between tries of a GET. */
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000];
/** A failure this quick is the phone being offline, not a sleeping server. */
const FAST_FAILURE_MS = 1_500;
/** After this many quick failures in a row we stop trying and say "offline". */
const FAST_FAILURES_MAX = 3;
/** Answers worth trying again: 0 (no answer), and the host's "starting up" answers. */
const RETRY_STATUSES = new Set([0, 502, 503, 504]);
/** The assistant calls an AI, which can be slow even when the server is awake. */
const ASSIST_TIMEOUT_MS = 30_000;
/** The warm-up ping at app start: it waits for the whole wake-up. */
const WARM_UP_TIMEOUT_MS = 75_000;
/** Longest wait for the login token (Supabase may be refreshing it over the network). */
const TOKEN_WAIT_MS = 5_000;

type Init = { method: string; headers: Record<string, string>; body?: string };

/**
 * Client for the FastAPI backend described in docs/API.md.
 * `getToken` returns the Supabase access token, or null when signed out.
 * `onUnauthorized` runs when the backend refuses a token we sent (401).
 * `getDeviceId` returns the install id (src/lib/deviceId.ts), or null.
 */
export function createHttpApi(
  baseUrl: string,
  getToken: () => Promise<string | null> = async () => null,
  onUnauthorized: () => void = () => undefined,
  getDeviceId: () => Promise<string | null> = async () => null,
): HaddakApi {
  const root = `${baseUrl.replace(/\/+$/, '')}/api/v1`;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body, auth = false, device = false, quiet = false } = options;
    const retry = options.retry ?? method === 'GET';
    const tryMs = options.timeoutMs ?? (retry ? RETRY_TRY_MS : TIMEOUT_MS);
    const started = Date.now();
    // The whole time this request may take, all tries together.
    const deadline = started + (retry ? Math.max(RETRY_BUDGET_MS, tryMs) : tryMs);
    const finished = quiet ? () => undefined : trackRequest();

    try {
      const search = Object.entries(query ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
      const url = `${root}${path}${search ? `?${search}` : ''}`;

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      // Public routes also send the token when there is one, so `is_mine` gets set on reviews.
      // Getting it can stall (Supabase refreshing an old token on a weak network), so it
      // waits at most TOKEN_WAIT_MS, and that time counts against the first try.
      let token: string | null = null;
      try {
        token = await withTimeout(getToken(), TOKEN_WAIT_MS);
      } catch {
        // No token in time: a public route goes without it; an account route cannot.
        if (auth) throw new ApiError(0, 'Sign-in did not answer in time');
      }
      if (token) headers.Authorization = `Bearer ${token}`;
      else if (auth) throw new ApiError(401, 'Not signed in');
      if (device) {
        const deviceId = await getDeviceId();
        if (deviceId) headers['X-Haddak-Device'] = deviceId;
      }
      const init: Init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };

      let fastFailures = 0;
      for (let attempt = 0; ; attempt += 1) {
        // The first try's clock started before the token; later tries start now.
        const tryStarted = attempt === 0 ? started : Date.now();
        const tryEnds = Math.min(tryStarted + tryMs, deadline);
        const sentAt = Date.now();
        try {
          return await send<T>(url, init, Math.max(tryEnds - sentAt, 1), token !== null);
        } catch (error) {
          if (!retry || !(error instanceof ApiError) || !RETRY_STATUSES.has(error.status)) throw error;
          // "Network request failed" at once, again and again: the phone is offline.
          fastFailures = error.status === 0 && Date.now() - sentAt < FAST_FAILURE_MS ? fastFailures + 1 : 0;
          if (fastFailures >= FAST_FAILURES_MAX) throw error;
          const pause = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
          // Not enough time left for a useful try.
          if (Date.now() + pause + FAST_FAILURE_MS > deadline) throw error;
          await wait(pause);
        }
      }
    } finally {
      finished();
    }
  }

  /** One try: sends the request and turns the answer into data or an ApiError. */
  async function send<T>(url: string, init: Init, timeoutMs: number, sentToken: boolean): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch {
      // Status 0 means the request never reached the server (offline, timeout).
      throw new ApiError(0, 'Network request failed');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const data: unknown = await response.json();
        if (data && typeof data === 'object' && 'detail' in data) {
          const value = (data as { detail: unknown }).detail;
          detail = typeof value === 'string' ? value : JSON.stringify(value);
        }
      } catch {
        // Keep the generic message.
      }
      // The token was refused (expired, revoked, or from another project): sign out
      // on this phone, so the app stops sending it and asks for a fresh sign-in.
      if (response.status === 401 && sentToken) onUnauthorized();
      // Retry-After is in seconds; only rate-limited (429) answers carry it.
      const retryAfter = Number(response.headers.get('Retry-After'));
      throw new ApiError(
        response.status,
        detail,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    // The warm-up ping (src/app/_layout.tsx): one long, quiet try that wakes a sleeping server.
    health: () =>
      request<HealthResponse>('/health', { timeoutMs: WARM_UP_TIMEOUT_MS, retry: false, quiet: true }),
    getCategories: () => request<Category[]>('/categories'),
    searchProviders: (params: SearchParams) =>
      // An empty name is left out, so the backend does not reject it as too short.
      request<Page<ProviderSummary>>('/providers/search', {
        // `include_unverified` is only sent when true; leaving it out means verified only.
        query: {
          ...params,
          q: params.q?.trim() || undefined,
          include_unverified: params.include_unverified ? true : undefined,
          // Defaults are left out, like include_unverified, to keep the URL short.
          open_now: params.open_now ? true : undefined,
          available_now: params.available_now ? true : undefined,
          sort: params.sort === 'best' ? undefined : params.sort,
        },
      }),
    getProvider: (providerId: string, from?: Coordinates) =>
      request<ProviderDetail>(`/providers/${id(providerId)}`, { query: { ...from } }),
    getProviderBySlug: (slug: string, from?: Coordinates) =>
      request<ProviderDetail>(`/providers/by-slug/${id(slug)}`, { query: { ...from } }),
    getReviews: (providerId: string, params?: ReviewListParams) =>
      request<Page<Review>>(`/providers/${id(providerId)}/reviews`, { query: { ...params } }),
    getProviderStories: (providerId: string) =>
      request<{ items: Story[] }>(`/providers/${id(providerId)}/stories`),
    getNearbyStories: (params: NearbyStoriesParams) =>
      request<{ items: StoryGroup[] }>('/stories/nearby', { query: { ...params } }),
    logContactEvent: (providerId: string, type: ContactEventType) =>
      request<void>(`/providers/${id(providerId)}/contact-events`, {
        method: 'POST',
        body: { type },
      }),
    submitSuggestion: (input: SuggestionInput) =>
      request<{ id: string }>('/suggestions', { method: 'POST', body: input }),
    reportProvider: (providerId: string, input: ReportInput) =>
      request<{ id: string }>(`/providers/${id(providerId)}/reports`, { method: 'POST', body: input }),
    // No login. The backend sends the AI only the sentence, never the position.
    assist: (body: AssistRequest) =>
      request<AssistResponse>('/assist', { method: 'POST', body, device: true, timeoutMs: ASSIST_TIMEOUT_MS }),

    getMyReview: (providerId: string) =>
      request<Review | null>(`/providers/${id(providerId)}/reviews/mine`, { auth: true }),
    upsertMyReview: (providerId: string, input: ReviewInput) =>
      request<Review>(`/providers/${id(providerId)}/reviews/mine`, {
        method: 'PUT',
        body: input,
        auth: true,
      }),
    deleteMyReview: (providerId: string) =>
      request<void>(`/providers/${id(providerId)}/reviews/mine`, { method: 'DELETE', auth: true }),
    deleteMyAccount: () => request<void>('/me', { method: 'DELETE', auth: true }),
    getMyProvider: () => request<OwnProvider>('/me/provider', { auth: true }),
    createMyProvider: (input: ProviderCreateInput) =>
      request<OwnProvider>('/me/provider', { method: 'POST', body: input, auth: true }),
    updateMyProvider: (input: ProviderUpdateInput) =>
      request<OwnProvider>('/me/provider', { method: 'PATCH', body: input, auth: true }),
    getMyProviderStats: () => request<ProviderStats>('/me/provider/stats', { auth: true }),
    postMyStory: (input: StoryInput) =>
      request<Story>('/me/provider/stories', { method: 'POST', body: input, auth: true }),
    deleteMyStory: (storyId: string) =>
      request<void>(`/me/provider/stories/${id(storyId)}`, { method: 'DELETE', auth: true }),
    setMyBanner: (input: BannerInput) =>
      request<Banner>('/me/provider/banner', { method: 'PUT', body: input, auth: true }),
    deleteMyBanner: () => request<void>('/me/provider/banner', { method: 'DELETE', auth: true }),
    setMyAvailable: (hours: AvailableHours) =>
      request<OwnProvider>('/me/provider/available', { method: 'PUT', body: { hours }, auth: true }),
    clearMyAvailable: () =>
      request<void>('/me/provider/available', { method: 'DELETE', auth: true }),
    followProvider: (providerId: string) =>
      request<void>(`/providers/${id(providerId)}/follow`, { method: 'PUT', auth: true }),
    unfollowProvider: (providerId: string) =>
      request<void>(`/providers/${id(providerId)}/follow`, { method: 'DELETE', auth: true }),
    getMyFollowing: (params?: FollowingParams) =>
      request<Page<ProviderSummary>>('/me/following', { query: { ...params }, auth: true }),
    getMyFeed: () => request<{ items: StoryGroup[] }>('/me/feed', { auth: true }),
    getPendingHireChecks: () =>
      request<{ items: HireCheck[] }>('/me/hire-checks/pending', { auth: true }),
    answerHireCheck: (checkId: string, answer: HireAnswer) =>
      request<void>(`/me/hire-checks/${id(checkId)}`, {
        method: 'POST',
        body: { answer },
        auth: true,
      }),
    claimProvider: (providerId: string, input: ClaimInput) =>
      request<Claim>(`/providers/${id(providerId)}/claim`, { method: 'POST', body: input, auth: true }),
  };
}
