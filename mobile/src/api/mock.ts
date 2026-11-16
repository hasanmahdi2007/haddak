import { isOpenAt } from '@/lib/hours';

import {
  MOCK_CATEGORIES,
  MOCK_PROVIDERS,
  REVIEW_AUTHORS,
  REVIEW_COMMENTS,
  mockBanner,
  mockStories,
} from './mockData';
import {
  ApiError,
  type Banner,
  type ContactEventType,
  type Coordinates,
  type HaddakApi,
  type OwnProvider,
  type ProviderDetail,
  type ProviderSummary,
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

const NOT_IN_MOCK = 'Not part of mock mode';

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
  function summary(provider: ProviderDetail, distance_m: number | null): ProviderSummary {
    return {
      ...toSummary(provider, distance_m),
      has_active_story: storiesOf(provider.id).length > 0,
      banner_title: bannerOf(provider.id)?.title ?? null,
      sponsor_hook: provider.sponsored ? (isOwn(provider.id) ? ownHook : provider.sponsor_hook) : null,
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
    };
  }

  function requireVerified() {
    ownProfile();
    if (ownKind !== 'verified') throw new ApiError(403, 'Only verified providers can post');
  }

  return {
    health: () => respond(() => ({ status: 'ok' })),

    getCategories: () => respond(() => MOCK_CATEGORIES),

    searchProviders: ({ lat, lng, radius_m, category_id, q, include_unverified = false, limit = 30, offset = 0 }) =>
      respond(() => {
        if (radius_m < 100 || radius_m > 50_000) {
          throw new ApiError(422, 'radius_m must be between 100 and 50000');
        }
        const name = q?.trim().toLowerCase();
        if (name !== undefined && (name.length < 2 || name.length > 60)) {
          throw new ApiError(422, 'q must be between 2 and 60 characters');
        }
        // The category itself plus its direct children (one level).
        const categoryIds =
          category_id === undefined
            ? null
            : new Set([
                category_id,
                ...MOCK_CATEGORIES.filter((c) => c.parent_id === category_id).map((c) => c.id),
              ]);

        const matches = MOCK_PROVIDERS.filter((p) => include_unverified || p.verified)
          .filter((p) => !categoryIds || categoryIds.has(p.category.id))
          .filter((p) => !name || p.name.toLowerCase().includes(name))
          .map((p) => summary(p, Math.round(haversineM({ lat, lng }, p))))
          .filter((p) => (p.distance_m ?? 0) <= radius_m);

        const ranked = rankProviders(matches);
        const size = Math.min(Math.max(limit, 1), 100);
        return { items: ranked.slice(offset, offset + size), total: ranked.length };
      }),

    getProvider: (id, from) => publicDetail(() => find((p) => p.id === id), from),

    getProviderBySlug: (slug, from) => publicDetail(() => find((p) => p.slug === slug), from),

    getReviews: (providerId, { limit = 20, offset = 0 } = {}) =>
      respond(() => {
        const provider = find((p) => p.id === providerId);
        let all = reviewCache.get(providerId);
        if (!all) {
          all = buildReviews(provider, MOCK_PROVIDERS.indexOf(provider) + 1);
          reviewCache.set(providerId, all);
        }
        const size = Math.min(Math.max(limit, 1), 50);
        return { items: all.slice(offset, offset + size), total: all.length };
      }),

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

    // Not used by any screen yet.
    upsertMyReview: () => Promise.reject(new ApiError(501, NOT_IN_MOCK)),
    deleteMyReview: () => Promise.reject(new ApiError(501, NOT_IN_MOCK)),
    createMyProvider: () => Promise.reject(new ApiError(501, NOT_IN_MOCK)),
    getMyProviderStats: () => Promise.reject(new ApiError(501, NOT_IN_MOCK)),

    getMyProvider: () => respondAuth(() => ownProvider()),

    updateMyProvider: (input) =>
      respondAuth(() => {
        ownProfile();
        if (input.sponsor_hook !== undefined) {
          const hook = input.sponsor_hook?.trim() ?? '';
          if (hook.length > 80) throw new ApiError(422, 'sponsor_hook must be at most 80 characters');
          ownHook = hook || null;
        }
        return ownProvider();
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
      },
      failNext: (count) => {
        failures = count;
      },
      events: () => events,
    },
  };
}
