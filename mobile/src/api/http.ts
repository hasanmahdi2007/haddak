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

type Query = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Send the login token; 401 if the user is signed out. */
  auth?: boolean;
  /** Send the install id (X-Haddak-Device), for Jarak's free daily allowance. */
  device?: boolean;
}

const TIMEOUT_MS = 12000;

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
    const { method = 'GET', query, body, auth = false, device = false } = options;

    const search = Object.entries(query ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    const url = `${root}${path}${search ? `?${search}` : ''}`;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // Public routes also send the token when there is one, so `is_mine` gets set on reviews.
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (auth) throw new ApiError(401, 'Not signed in');
    if (device) {
      const deviceId = await getDeviceId();
      if (deviceId) headers['X-Haddak-Device'] = deviceId;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
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
      if (response.status === 401 && token) onUnauthorized();
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
    health: () => request<HealthResponse>('/health'),
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
      request<AssistResponse>('/assist', { method: 'POST', body, device: true }),

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
