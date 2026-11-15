import {
  ApiError,
  type Category,
  type ContactEventType,
  type Coordinates,
  type HaddakApi,
  type HealthResponse,
  type OwnProvider,
  type Page,
  type ProviderCreateInput,
  type ProviderDetail,
  type ProviderStats,
  type ProviderSummary,
  type ProviderUpdateInput,
  type Review,
  type ReviewInput,
  type ReviewListParams,
  type SearchParams,
  type SuggestionInput,
} from './types';

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Send the login token; 401 if the user is signed out. */
  auth?: boolean;
}

const TIMEOUT_MS = 12000;

/**
 * Client for the FastAPI backend described in docs/API.md.
 * `getToken` returns the Supabase access token, or null when signed out.
 */
export function createHttpApi(
  baseUrl: string,
  getToken: () => Promise<string | null> = async () => null,
): HaddakApi {
  const root = `${baseUrl.replace(/\/+$/, '')}/api/v1`;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body, auth = false } = options;

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
        query: { ...params, q: params.q?.trim() || undefined },
      }),
    getProvider: (providerId: string, from?: Coordinates) =>
      request<ProviderDetail>(`/providers/${id(providerId)}`, { query: { ...from } }),
    getProviderBySlug: (slug: string, from?: Coordinates) =>
      request<ProviderDetail>(`/providers/by-slug/${id(slug)}`, { query: { ...from } }),
    getReviews: (providerId: string, params?: ReviewListParams) =>
      request<Page<Review>>(`/providers/${id(providerId)}/reviews`, { query: { ...params } }),
    logContactEvent: (providerId: string, type: ContactEventType) =>
      request<void>(`/providers/${id(providerId)}/contact-events`, {
        method: 'POST',
        body: { type },
      }),
    submitSuggestion: (input: SuggestionInput) =>
      request<{ id: string }>('/suggestions', { method: 'POST', body: input }),

    upsertMyReview: (providerId: string, input: ReviewInput) =>
      request<Review>(`/providers/${id(providerId)}/reviews/mine`, {
        method: 'PUT',
        body: input,
        auth: true,
      }),
    deleteMyReview: (providerId: string) =>
      request<void>(`/providers/${id(providerId)}/reviews/mine`, { method: 'DELETE', auth: true }),
    getMyProvider: () => request<OwnProvider>('/me/provider', { auth: true }),
    createMyProvider: (input: ProviderCreateInput) =>
      request<OwnProvider>('/me/provider', { method: 'POST', body: input, auth: true }),
    updateMyProvider: (input: ProviderUpdateInput) =>
      request<OwnProvider>('/me/provider', { method: 'PATCH', body: input, auth: true }),
    getMyProviderStats: () => request<ProviderStats>('/me/provider/stats', { auth: true }),
  };
}
