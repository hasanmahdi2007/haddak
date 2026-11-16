import { isOpenAt } from '@/lib/hours';

import {
  MOCK_CATEGORIES,
  MOCK_PLACES,
  MOCK_PROVIDERS,
  REVIEW_AUTHORS,
  REVIEW_COMMENTS,
  mockBanner,
  mockStories,
} from './mockData';
import { baseUnderstood, buildDraft, buildSummary, understandText } from './mockAssist';
import { applyOwnEdits, buildOwnProvider, mockStats } from './mockOwner';
import {
  ApiError,
  type AssistResponse,
  type Banner,
  type ContactEventType,
  type Coordinates,
  type HaddakApi,
  type OwnProvider,
  type ProviderDetail,
  type ProviderSummary,
  type ProviderUpdateInput,
  type ReportReason,
  type SearchParams,
  type Understood,
  type UnderstoodInput,
  type Review,
  type Story,
  type StoryGroup,
} from './types';

/** Great-circle distance in metres (what PostGIS ST_Distance gives on geography). */
export function haversineM(a: Coordinates, b: Coordinates): number {
  const R = 6_371_008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ranking from docs/SCHEMA.md: stops one 5-star review from beating fifty 4.8-star ones. */
export function weightedRating(avgRating: number, reviewCount: number): number {
  return (reviewCount * avgRating + 5 * 3.5) / (reviewCount + 5);
}

/**
 * Sponsored first, then verified before unverified, then featured, then weighted
 * rating (high to low), then distance (near to far).
 */
export function rankProviders<T extends ProviderSummary>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.sponsored) !== Boolean(b.sponsored)) return a.sponsored ? -1 : 1;
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    const byRating =
      weightedRating(b.avg_rating, b.review_count) - weightedRating(a.avg_rating, a.review_count);
    if (byRating !== 0) return byRating;
    return (a.distance_m ?? 0) - (b.distance_m ?? 0);
  });
}

function toSummary(provider: ProviderDetail, distance_m: number | null): ProviderSummary {
  const {
    id,
    slug,
    name,
    category,
    area_name,
    price_text,
    price_amount = null,
    price_unit = null,
    price_currency = null,
    avg_rating,
    review_count,
    verified,
    claimed,
    founding_member,
    featured,
    lat,
    lng,
    cover_photo_url,
    sponsored,
    sponsor_hook,
  } = provider;
  return {
    id,
    slug,
    name,
    category,
    area_name,
    price_text,
    price_amount,
    price_unit,
    price_currency,
    avg_rating,
    review_count,
    verified,
    claimed,
    founding_member,
    featured,
    lat,
    lng,
    distance_m,
    sponsored,
    sponsor_hook,
    // Stories and banners are dated from "now", so they never run out in mock mode.
    has_active_story: mockStories(id).length > 0,
    banner_title: mockBanner(id)?.title ?? null,
    cover_photo_url,
    // The backend works this out in Lebanon time; the mock uses the device clock.
    open_now: isOpenAt(provider.opening_hours, new Date()),
  };
}

/** Small deterministic random generator, so mock reviews are the same on every run. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function buildReviews(provider: ProviderDetail, index: number): Review[] {
  const random = seeded(index * 7919 + 17);
  const reviews: Review[] = [];
  let time = Date.parse('2026-11-12T16:00:00Z');
  for (let i = 0; i < provider.review_count; i += 1) {
    // Each review is one to four days older than the one before it.
    if (i > 0) time -= (1 + Math.floor(random() * 4)) * 86_400_000;
    // Ratings scatter around the provider's average.
    const rating = Math.max(1, Math.min(5, Math.round(provider.avg_rating + (random() - 0.5) * 1.6)));
    const comments = REVIEW_COMMENTS[rating];
    reviews.push({
      id: `${provider.id.slice(0, 24)}${String(900000000000 + i)}`,
      author_name: REVIEW_AUTHORS[Math.floor(random() * REVIEW_AUTHORS.length)],
      rating,
      comment: comments[Math.floor(random() * comments.length)],
      created_at: new Date(time).toISOString(),
      is_mine: false,
    });
  }
  return reviews; // already newest first
}

/** What GET /me/provider answers in mock mode (switch it with `controls.setOwnProvider`). */
export type MockOwnProvider = 'verified' | 'pending' | 'none';

export interface MockControls {
  /** Make the next `count` requests fail, to see error states. */
  failNext(count: number): void;
  /** Contact events logged so far, per provider. */
  events(): Record<string, Record<ContactEventType, number>>;
  /** Whether the signed-in user has a profile, and its status. */
  setOwnProvider(kind: MockOwnProvider): void;
}

/** In mock mode the signed-in user owns the first provider (a verified laptop repair shop). */
const OWN_ID = MOCK_PROVIDERS[0].id;
const STORY_MAX = 5;
const HOUR_MS = 3_600_000;

/**
 * In-memory implementation of the API contract, used when EXPO_PUBLIC_API_URL is unset.
 * Account calls need a token (any token: nothing checks it here), the way the
 * backend needs a login; without one they answer 401.
 */
export function createMockApi(
  getToken: () => Promise<string | null> = async () => null,
): HaddakApi & { controls: MockControls } {
  let failures = 0;
  const events: Record<string, Record<ContactEventType, number>> = {};
  const reviewCache = new Map<string, Review[]>();
  // Times of the suggestions sent in this session, for the 5-per-hour limit.
  let suggestionTimes: number[] = [];
  // Followed provider ids, most recently followed first.
  let following: string[] = [];
  let ownKind: MockOwnProvider = 'verified';
  // The owner's stories, banner and hook start from the seed data and then change.
  let ownStories: Story[] | null = null;
  let ownBanner: Banner | null | undefined;
  let ownHook: string | null = MOCK_PROVIDERS[0].sponsor_hook;
  // A listing made with "List your business" in this session (after setOwnProvider('none')).
  let createdOwn: OwnProvider | null = null;
  // Edits to the seed listing other than the hook, applied over it on every read.
  let ownEdits: ProviderUpdateInput = {};
  // The signed-in user's reviews, by provider id (mock mode has one user).
  const myReviews = new Map<string, Review>();
  // Times of the reports sent in this session, for the 10-per-hour limit.
  let reportTimes: number[] = [];

  const isOwn = (providerId: string) => providerId === OWN_ID && ownKind !== 'none';
  // While the profile is not verified, its stories and banner are hidden everywhere public.
  const ownVisible = () => ownKind === 'verified';

  /** The owner's stories as stored (expired ones dropped), whatever the status. */
  function ownStoryList(): Story[] {
    ownStories ??= mockStories(OWN_ID);
    const now = Date.now();
    ownStories = ownStories.filter((story) => Date.parse(story.expires_at) > now);
    return ownStories;
  }
  function storiesOf(providerId: string): Story[] {
    if (!isOwn(providerId)) return mockStories(providerId);
    return ownVisible() ? ownStoryList() : [];
  }
  function bannerOf(providerId: string): Banner | null {
    if (!isOwn(providerId)) return mockBanner(providerId);
    if (ownBanner === undefined) ownBanner = mockBanner(OWN_ID);
    if (ownBanner && Date.parse(ownBanner.expires_at) <= Date.now()) ownBanner = null;
    return ownVisible() ? ownBanner : null;
  }
  /** The seed reviews of a provider, built once, then kept. */
  function seedReviews(provider: ProviderDetail): Review[] {
    let all = reviewCache.get(provider.id);
    if (!all) {
      all = buildReviews(provider, MOCK_PROVIDERS.indexOf(provider) + 1);
      reviewCache.set(provider.id, all);
    }
    return all;
  }
  /** Every review of a provider, newest first, with mine marked when signed in. */
  function reviewsOf(provider: ProviderDetail, signedIn: boolean): Review[] {
    const mine = myReviews.get(provider.id);
    const seeds = seedReviews(provider);
    return mine ? [{ ...mine, is_mine: signedIn }, ...seeds] : seeds;
  }
  /** Like the backend, the average follows every write; untouched providers keep their seed numbers. */
  function ratingOf(provider: ProviderDetail): { avg_rating: number; review_count: number } {
    const mine = myReviews.get(provider.id);
    if (!mine) return { avg_rating: provider.avg_rating, review_count: provider.review_count };
    const all = [mine, ...seedReviews(provider)];
    const sum = all.reduce((total, review) => total + review.rating, 0);
    return { avg_rating: Math.round((sum / all.length) * 100) / 100, review_count: all.length };
  }
  function summary(provider: ProviderDetail, distance_m: number | null): ProviderSummary {
    return {
      ...toSummary(provider, distance_m),
      ...ratingOf(provider),
      has_active_story: storiesOf(provider.id).length > 0,
      banner_title: bannerOf(provider.id)?.title ?? null,
      sponsor_hook: provider.sponsored ? (isOwn(provider.id) ? ownHook : provider.sponsor_hook) : null,
    };
  }

  /**
   * The search behind GET /providers/search and the assistant. `categoryIds` are
   * searched with their children; null means every category.
   */
  function search(params: SearchParams, categoryIds: number[] | null) {
    const { lat, lng, radius_m, include_unverified = false, limit = 30, offset = 0 } = params;
    const name = params.q?.trim().toLowerCase();
    const wanted =
      categoryIds === null
        ? null
        : new Set(
            categoryIds.flatMap((id) => [id, ...MOCK_CATEGORIES.filter((c) => c.parent_id === id).map((c) => c.id)]),
          );
    const currency = params.price_currency ?? 'USD';

    const matches = MOCK_PROVIDERS.filter((p) => include_unverified || p.verified)
      .filter((p) => !wanted || wanted.has(p.category.id))
      .filter((p) => !name || p.name.toLowerCase().includes(name))
      .map((p) => summary(p, Math.round(haversineM({ lat, lng }, p))))
      .filter((p) => (p.distance_m ?? 0) <= radius_m)
      // A price limit leaves out everyone without a structured price in that unit and currency.
      .filter(
        (p) =>
          params.max_price === undefined ||
          (p.price_amount != null &&
            p.price_unit === params.price_unit &&
            p.price_currency === currency &&
            p.price_amount <= params.max_price),
      )
      .filter((p) => !params.open_now || p.open_now === true);

    let ranked = rankProviders(matches);
    if (params.sort === 'distance') {
      // Nearest first, but verified still before not verified.
      ranked = [...matches].sort(
        (a, b) => Number(b.verified) - Number(a.verified) || (a.distance_m ?? 0) - (b.distance_m ?? 0),
      );
    } else if (params.sort === 'price') {
      // Cheapest structured price first; the rest keep the normal order after them.
      const order = new Map(ranked.map((p, i) => [p.id, i]));
      ranked = [...ranked].sort((a, b) => {
        const pa = a.price_amount ?? Number.POSITIVE_INFINITY;
        const pb = b.price_amount ?? Number.POSITIVE_INFINITY;
        return pa - pb || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
      });
    }
    const size = Math.min(Math.max(limit, 1), 100);
    return { items: ranked.slice(offset, offset + size), total: ranked.length };
  }

  /** Run the assistant's settings: centred on the place or the phone, widened when empty. */
  function assistSearch(
    input: UnderstoodInput,
    phone: Coordinates,
    lang: 'en' | 'ar',
    draft: string | null,
  ): AssistResponse {
    // A place chosen from `place_options` arrives as a slug: look it up, like the backend.
    const known = input.place ? MOCK_PLACES.find((p) => p.slug === input.place?.slug) : undefined;
    if (input.place && !known) throw new ApiError(422, 'Unknown place');
    const understood: Understood = {
      ...baseUnderstood(input.category_slugs),
      ...input,
      place: known
        ? { slug: known.slug, name_en: known.name_en, name_ar: known.name_ar, lat: known.lat, lng: known.lng }
        : null,
    };
    const ids = understood.category_slugs
      .map((slug) => MOCK_CATEGORIES.find((c) => c.slug === slug)?.id)
      .filter((id): id is number => id !== undefined);
    const centre = understood.place ?? phone;
    const run = (radius_m: number) =>
      search(
        {
          lat: centre.lat,
          lng: centre.lng,
          radius_m,
          q: understood.q ?? undefined,
          max_price: understood.max_price ?? undefined,
          price_unit: understood.price_unit ?? undefined,
          price_currency: understood.price_currency,
          open_now: understood.open_now,
          sort: understood.sort,
          limit: 10,
        },
        ids.length > 0 ? ids : null,
      );

    let results = run(understood.radius_m);
    let widened = false;
    // Nothing found: widen step by step (1 km, 5 km, city) and say so.
    for (const wider of [1000, 5000, 20000]) {
      if (results.total > 0 || wider <= understood.radius_m) continue;
      understood.radius_m = wider;
      results = run(wider);
      widened = true;
    }
    return {
      kind: 'results',
      understood,
      summary: buildSummary(understood, lang),
      results,
      widened,
      question: null,
      place_options: null,
      place_unknown: null,
      whatsapp_draft: draft,
    };
  }

  /** Like `respond`, for routes that need a login. */
  async function respondAuth<T>(build: () => T): Promise<T> {
    const token = await getToken();
    return respond(() => {
      if (!token) throw new ApiError(401, 'Not signed in');
      return build();
    });
  }

  async function respond<T>(build: () => T): Promise<T> {
    // A realistic pause so loading states are visible.
    await new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 250));
    if (failures > 0) {
      failures -= 1;
      throw new ApiError(0, 'Network request failed');
    }
    return build();
  }

  function find(predicate: (provider: ProviderDetail) => boolean): ProviderDetail {
    const provider = MOCK_PROVIDERS.find(predicate);
    if (!provider) throw new ApiError(404, 'Provider not found');
    return provider;
  }

  function detail(provider: ProviderDetail, from?: Coordinates, signedIn = false): ProviderDetail {
    return {
      ...provider,
      ...summary(provider, from ? Math.round(haversineM(from, provider)) : null),
      // The backend always returns a WhatsApp number, falling back to the phone.
      whatsapp: provider.whatsapp ?? provider.phone,
      active_banner: bannerOf(provider.id),
      // The seed counts are other people; this user's follow is added on top.
      follower_count: provider.follower_count + (following.includes(provider.id) ? 1 : 0),
      // Always false while signed out, as on the backend.
      is_following: signedIn && following.includes(provider.id),
    };
  }

  /** Detail for the public routes: `is_following` depends on whether someone is signed in. */
  async function publicDetail(provider: () => ProviderDetail, from?: Coordinates) {
    const signedIn = (await getToken()) !== null;
    return respond(() => detail(provider(), from, signedIn));
  }

  function ownProfile(): ProviderDetail {
    if (ownKind === 'none') throw new ApiError(404, 'You have no provider profile');
    return find((p) => p.id === OWN_ID);
  }

  function ownProvider(): OwnProvider {
    const provider = ownProfile();
    const verified = ownKind === 'verified';
    return {
      ...detail(provider, undefined, true),
      verified,
      status: verified ? 'verified' : 'pending',
      sponsored: verified && provider.sponsored,
      featured: verified && provider.featured,
      // The owner always sees the stored hook, sponsored or not.
      sponsor_hook: ownHook,
      featured_until: provider.sponsored ? new Date(Date.now() + 20 * 24 * HOUR_MS).toISOString() : null,
      verification_doc_url: null,
      show_contact_count: false,
    };
  }

  /** What GET /me/provider answers: a listing made here, or the seed listing with its edits. */
  function currentOwn(): OwnProvider {
    if (createdOwn) return createdOwn;
    // The hook has its own variable (ownHook), so it is left out of the edits.
    return applyOwnEdits(ownProvider(), { ...ownEdits, sponsor_hook: undefined });
  }

  function requireVerified() {
    ownProfile();
    if (ownKind !== 'verified') throw new ApiError(403, 'Only verified providers can post');
  }

  return {
    health: () => respond(() => ({ status: 'ok' })),

    getCategories: () => respond(() => MOCK_CATEGORIES),

    searchProviders: (params) =>
      respond(() => {
        const { radius_m, category_id, q } = params;
        if (radius_m < 100 || radius_m > 50_000) {
          throw new ApiError(422, 'radius_m must be between 100 and 50000');
        }
        const name = q?.trim().toLowerCase();
        if (name !== undefined && (name.length < 2 || name.length > 60)) {
          throw new ApiError(422, 'q must be between 2 and 60 characters');
        }
        if (params.max_price !== undefined && !params.price_unit) {
          throw new ApiError(422, 'price_unit is required with max_price');
        }
        return search(params, category_id === undefined ? null : [category_id]);
      }),

    // The fake assistant: keyword rules (mockAssist.ts) instead of an AI, then the same search.
    assist: (request) =>
      respond((): AssistResponse => {
        const { lat, lng, lang } = request;
        if ('understood' in request) return assistSearch(request.understood, { lat, lng }, lang, null);

        const text = request.text.trim();
        if (text.length < 2 || text.length > 300) throw new ApiError(422, 'text must be 2 to 300 characters');
        const reading = understandText(text, lang);
        const empty: AssistResponse = {
          kind: 'unavailable',
          understood: null,
          summary: null,
          results: null,
          widened: false,
          question: null,
          place_options: null,
          place_unknown: null,
          whatsapp_draft: null,
        };
        switch (reading.kind) {
          case 'emergency':
          case 'off_topic':
          case 'unavailable':
            return { ...empty, kind: reading.kind };
          case 'clarify':
            return { ...empty, kind: 'clarify', question: reading.question, whatsapp_draft: buildDraft(text, lang) };
          case 'search': {
            const draft = buildDraft(text, lang);
            if (reading.placeOptions) {
              // Two places share the name: nothing is searched until one is chosen.
              return {
                ...empty,
                kind: 'results',
                understood: reading.understood,
                place_options: reading.placeOptions.map(({ slug, name_en, name_ar, district }) => ({
                  slug,
                  name_en,
                  name_ar,
                  district,
                })),
                whatsapp_draft: draft,
              };
            }
            return {
              ...assistSearch(reading.understood, { lat, lng }, lang, draft),
              place_unknown: reading.placeUnknown,
            };
          }
        }
      }),

    getProvider: (id, from) => publicDetail(() => find((p) => p.id === id), from),

    getProviderBySlug: (slug, from) => publicDetail(() => find((p) => p.slug === slug), from),

    getReviews: async (providerId, { limit = 20, offset = 0 } = {}) => {
      const signedIn = (await getToken()) !== null;
      return respond(() => {
        const all = reviewsOf(find((p) => p.id === providerId), signedIn);
        const size = Math.min(Math.max(limit, 1), 50);
        return { items: all.slice(offset, offset + size), total: all.length };
      });
    },

    getProviderStories: (providerId) =>
      respond(() => {
        find((p) => p.id === providerId);
        return { items: storiesOf(providerId) };
      }),

    getNearbyStories: ({ lat, lng, radius_m }) =>
      respond(() => {
        const items = MOCK_PROVIDERS.filter((p) => p.verified)
          .map((p) => ({
            provider: summary(p, Math.round(haversineM({ lat, lng }, p))),
            stories: storiesOf(p.id),
          }))
          .filter((group) => group.stories.length > 0 && (group.provider.distance_m ?? 0) <= radius_m)
          // The provider with the newest story comes first.
          .sort((a, b) => Date.parse(b.stories[0].created_at) - Date.parse(a.stories[0].created_at));
        return { items: items.slice(0, 30) };
      }),

    logContactEvent: (providerId, type) =>
      respond(() => {
        find((p) => p.id === providerId);
        const counts = (events[providerId] ??= { view: 0, whatsapp: 0, call: 0 });
        counts[type] += 1;
        if (__DEV__) console.log(`[mock] contact event: ${type} for ${providerId}`);
      }),

    submitSuggestion: (input) =>
      respond(() => {
        const now = Date.now();
        suggestionTimes = suggestionTimes.filter((time) => now - time < 3_600_000);
        if (suggestionTimes.length >= 5) {
          const waitS = Math.ceil((suggestionTimes[0] + 3_600_000 - now) / 1000);
          throw new ApiError(429, 'Too many requests', waitS);
        }
        // Like the backend, a request refused for a validation error still counts.
        suggestionTimes.push(now);
        const name = input.name.trim();
        if (name.length < 1 || name.length > 100) throw new ApiError(422, 'name must be 1 to 100 characters');
        if (input.phone !== undefined && !/^\+\d{8,15}$/.test(input.phone)) {
          throw new ApiError(422, 'phone must be in international format');
        }
        if ((input.area_name ?? '').length > 100) throw new ApiError(422, 'area_name is too long');
        if ((input.note ?? '').length > 500) throw new ApiError(422, 'note is too long');
        if (input.category_id !== undefined && !MOCK_CATEGORIES.some((c) => c.id === input.category_id)) {
          throw new ApiError(400, 'Unknown category');
        }
        if (__DEV__) console.log('[mock] suggestion:', input);
        return { id: `00000000-0000-4000-9000-${String(now).slice(-12).padStart(12, '0')}` };
      }),

    reportProvider: (providerId, input) =>
      respond(() => {
        const now = Date.now();
        reportTimes = reportTimes.filter((time) => now - time < 3_600_000);
        if (reportTimes.length >= 10) {
          const waitS = Math.ceil((reportTimes[0] + 3_600_000 - now) / 1000);
          throw new ApiError(429, 'Too many requests', waitS);
        }
        // Like the backend, refused requests count too.
        reportTimes.push(now);
        find((p) => p.id === providerId);
        const reasons: ReportReason[] = ['wrong_info', 'not_real', 'closed', 'offensive', 'other'];
        if (!reasons.includes(input.reason)) throw new ApiError(422, 'Unknown reason');
        if ((input.note ?? '').length > 500) throw new ApiError(422, 'note is too long');
        if (__DEV__) console.log('[mock] report:', providerId, input);
        return { id: `00000000-0000-4000-a000-${String(now).slice(-12).padStart(12, '0')}` };
      }),

    getMyReview: (providerId) =>
      respondAuth(() => {
        find((p) => p.id === providerId);
        const mine = myReviews.get(providerId);
        return mine ? { ...mine, is_mine: true } : null;
      }),

    upsertMyReview: (providerId, { rating, comment, author_name }) =>
      respondAuth(() => {
        find((p) => p.id === providerId);
        // As on the backend: nobody reviews their own listing.
        if (isOwn(providerId)) throw new ApiError(403, 'You cannot review your own profile');
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(422, 'rating must be 1 to 5');
        const name = author_name.trim();
        if (name.length < 1 || name.length > 80) throw new ApiError(422, 'author_name must be 1 to 80 characters');
        if (comment.length > 2000) throw new ApiError(422, 'comment is too long');
        const before = myReviews.get(providerId);
        const review: Review = {
          id: before?.id ?? `00000000-0000-4000-b000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
          author_name: name,
          rating,
          comment: comment.trim(),
          created_at: before?.created_at ?? new Date().toISOString(),
          is_mine: true,
        };
        myReviews.set(providerId, review);
        return review;
      }),

    deleteMyReview: (providerId) =>
      respondAuth(() => {
        find((p) => p.id === providerId);
        if (isOwn(providerId)) throw new ApiError(403, 'You cannot review your own profile');
        myReviews.delete(providerId);
      }),

    // Not used by any screen yet.
    createMyProvider: (input) =>
      respondAuth(() => {
        if (createdOwn || ownKind !== 'none') throw new ApiError(409, 'You already have a provider profile');
        createdOwn = buildOwnProvider(input);
        return createdOwn;
      }),

    getMyProviderStats: () =>
      respondAuth(() => {
        if (!createdOwn) ownProfile();
        return mockStats(createdOwn !== null);
      }),

    getMyProvider: () => respondAuth(() => currentOwn()),

    updateMyProvider: (input) =>
      respondAuth(() => {
        if (createdOwn) {
          createdOwn = applyOwnEdits(createdOwn, input);
          return createdOwn;
        }
        ownProfile();
        // Checked here so a bad edit is refused before it is kept.
        applyOwnEdits(currentOwn(), { ...input, sponsor_hook: undefined });
        ownEdits = { ...ownEdits, ...input };
        if (input.sponsor_hook !== undefined) {
          const hook = input.sponsor_hook?.trim() ?? '';
          if (hook.length > 80) throw new ApiError(422, 'sponsor_hook must be at most 80 characters');
          ownHook = hook || null;
        }
        return currentOwn();
      }),

    postMyStory: ({ text, image_url }) =>
      respondAuth(() => {
        requireVerified();
        const words = text.trim();
        if (words.length < 1 || words.length > 280) throw new ApiError(422, 'text must be 1 to 280 characters');
        const image = image_url?.trim() || null;
        if (image && (!image.startsWith('https://') || image.length > 1000)) {
          throw new ApiError(422, 'image_url must start with https://');
        }
        const active = ownStoryList();
        if (active.length >= STORY_MAX) throw new ApiError(409, 'You already have 5 active stories');
        const now = Date.now();
        const story: Story = {
          id: `00000000-0000-4000-8000-${String(now).slice(-12).padStart(12, '0')}`,
          provider_id: OWN_ID,
          text: words,
          image_url: image,
          created_at: new Date(now).toISOString(),
          expires_at: new Date(now + 24 * HOUR_MS).toISOString(),
        };
        ownStories = [story, ...active];
        return story;
      }),

    deleteMyStory: (storyId) =>
      respondAuth(() => {
        ownProfile();
        const before = ownStoryList();
        if (!before.some((story) => story.id === storyId)) throw new ApiError(404, 'Story not found');
        ownStories = before.filter((story) => story.id !== storyId);
      }),

    setMyBanner: ({ title, text, discount_percent, days = 7 }) =>
      respondAuth(() => {
        requireVerified();
        const name = title.trim();
        if (name.length < 1 || name.length > 60) throw new ApiError(422, 'title must be 1 to 60 characters');
        if ((text ?? '').length > 200) throw new ApiError(422, 'text must be at most 200 characters');
        if (discount_percent != null && (discount_percent < 1 || discount_percent > 90)) {
          throw new ApiError(422, 'discount_percent must be 1 to 90');
        }
        if (days < 1 || days > 7) throw new ApiError(422, 'days must be 1 to 7');
        const now = Date.now();
        const banner: Banner = {
          title: name,
          text: text?.trim() || null,
          discount_percent: discount_percent ?? null,
          starts_at: new Date(now).toISOString(),
          expires_at: new Date(now + days * 24 * HOUR_MS).toISOString(),
        };
        ownBanner = banner;
        return banner;
      }),

    deleteMyBanner: () =>
      respondAuth(() => {
        ownProfile();
        ownBanner = null;
      }),

    followProvider: (providerId) =>
      respondAuth(() => {
        find((p) => p.id === providerId);
        following = [providerId, ...following.filter((id) => id !== providerId)];
      }),

    unfollowProvider: (providerId) =>
      respondAuth(() => {
        find((p) => p.id === providerId);
        following = following.filter((id) => id !== providerId);
      }),

    getMyFollowing: ({ limit = 50, offset = 0 } = {}) =>
      respondAuth(() => {
        const all = following.map((id) => summary(find((p) => p.id === id), null));
        const size = Math.min(Math.max(limit, 1), 100);
        return { items: all.slice(offset, offset + size), total: all.length };
      }),

    getMyFeed: () =>
      respondAuth(() => {
        const items: StoryGroup[] = following
          .map((id) => find((p) => p.id === id))
          .filter((p) => p.verified)
          .map((p) => ({ provider: summary(p, null), stories: storiesOf(p.id) }))
          .filter((group) => group.stories.length > 0)
          // The provider with the newest story comes first.
          .sort((a, b) => Date.parse(b.stories[0].created_at) - Date.parse(a.stories[0].created_at));
        return { items: items.slice(0, 30) };
      }),

    controls: {
      setOwnProvider: (kind) => {
        ownKind = kind;
        createdOwn = null;
        ownEdits = {};
      },
      failNext: (count) => {
        failures = count;
      },
      events: () => events,
    },
  };
}
