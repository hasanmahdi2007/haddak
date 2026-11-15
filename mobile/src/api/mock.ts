import { MOCK_CATEGORIES, MOCK_PROVIDERS, REVIEW_AUTHORS, REVIEW_COMMENTS } from './mockData';
import {
  ApiError,
  type ContactEventType,
  type Coordinates,
  type HaddakApi,
  type ProviderDetail,
  type ProviderSummary,
  type Review,
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

/** Featured first, then weighted rating (high to low), then distance (near to far). */
export function rankProviders<T extends ProviderSummary>(items: T[]): T[] {
  return [...items].sort((a, b) => {
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
    founding_member,
    featured,
    lat,
    lng,
    cover_photo_url,
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
    founding_member,
    featured,
    lat,
    lng,
    distance_m,
    cover_photo_url,
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

const NOT_IN_MOCK = 'Sign-in is not part of mock mode yet';

export interface MockControls {
  /** Make the next `count` requests fail, to see error states. */
  failNext(count: number): void;
  /** Contact events logged so far, per provider. */
  events(): Record<string, Record<ContactEventType, number>>;
}

/** In-memory implementation of the API contract, used when EXPO_PUBLIC_API_URL is unset. */
export function createMockApi(): HaddakApi & { controls: MockControls } {
  let failures = 0;
  const events: Record<string, Record<ContactEventType, number>> = {};
  const reviewCache = new Map<string, Review[]>();

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

  function detail(provider: ProviderDetail, from?: Coordinates): ProviderDetail {
    return {
      ...provider,
      // The backend always returns a WhatsApp number, falling back to the phone.
      whatsapp: provider.whatsapp ?? provider.phone,
      distance_m: from ? Math.round(haversineM(from, provider)) : null,
    };
  }

  return {
    health: () => respond(() => ({ status: 'ok' })),

    getCategories: () => respond(() => MOCK_CATEGORIES),

    searchProviders: ({ lat, lng, radius_m, category_id, q, limit = 30, offset = 0 }) =>
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

        const matches = MOCK_PROVIDERS.filter((p) => p.verified)
          .filter((p) => !categoryIds || categoryIds.has(p.category.id))
          .filter((p) => !name || p.name.toLowerCase().includes(name))
          .map((p) => toSummary(p, Math.round(haversineM({ lat, lng }, p))))
          .filter((p) => (p.distance_m ?? 0) <= radius_m);

        const ranked = rankProviders(matches);
        const size = Math.min(Math.max(limit, 1), 100);
        return { items: ranked.slice(offset, offset + size), total: ranked.length };
      }),

    getProvider: (id, from) => respond(() => detail(find((p) => p.id === id), from)),

    getProviderBySlug: (slug, from) => respond(() => detail(find((p) => p.slug === slug), from)),

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

    logContactEvent: (providerId, type) =>
      respond(() => {
        find((p) => p.id === providerId);
        const counts = (events[providerId] ??= { view: 0, whatsapp: 0, call: 0 });
        counts[type] += 1;
        if (__DEV__) console.log(`[mock] contact event: ${type} for ${providerId}`);
      }),

    upsertMyReview: () => Promise.reject(new ApiError(401, NOT_IN_MOCK)),
    deleteMyReview: () => Promise.reject(new ApiError(401, NOT_IN_MOCK)),
    getMyProvider: () => Promise.reject(new ApiError(401, NOT_IN_MOCK)),
    createMyProvider: () => Promise.reject(new ApiError(401, NOT_IN_MOCK)),
    updateMyProvider: () => Promise.reject(new ApiError(401, NOT_IN_MOCK)),
    getMyProviderStats: () => Promise.reject(new ApiError(401, NOT_IN_MOCK)),

    controls: {
      failNext: (count) => {
        failures = count;
      },
      events: () => events,
    },
  };
}
