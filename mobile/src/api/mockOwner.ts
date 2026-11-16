import { isOpenAt } from '@/lib/hours';

import { MOCK_CATEGORIES } from './mockData';
import {
  ApiError,
  type OpeningHours,
  type OwnProvider,
  type ProviderCreateInput,
  type ProviderStats,
  type ProviderUpdateInput,
} from './types';

/**
 * Mock mode's side of "List your business" and "Edit listing": the same rules
 * as POST and PATCH /me/provider (docs/API.md), kept apart from mock.ts so that
 * file stays about reading.
 */

const PHONE = /^\+\d{8,15}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkText(value: string | null | undefined, field: string, min: number, max: number) {
  const length = (value ?? '').trim().length;
  if (length < min || length > max) throw new ApiError(422, `${field} must be ${min} to ${max} characters`);
}

function checkPhone(value: string | null | undefined, field: string) {
  if (value != null && !PHONE.test(value)) {
    throw new ApiError(422, `${field} must be in international format: + and 8 to 15 digits`);
  }
}

function checkHours(hours: OpeningHours | null | undefined) {
  for (const [day, ranges] of Object.entries(hours ?? {})) {
    if ((ranges ?? []).length > 3) throw new ApiError(422, `${day}: at most 3 ranges`);
    for (const [open, close] of ranges ?? []) {
      if (!CLOCK.test(open) || !CLOCK.test(close) || open >= close) {
        throw new ApiError(422, `${day}: open must be before close`);
      }
    }
  }
}

function categoryRef(id: number) {
  const category = MOCK_CATEGORIES.find((item) => item.id === id);
  if (!category) throw new ApiError(400, 'Unknown category');
  const { slug, name_en, name_ar, icon } = category;
  return { id, slug, name_en, name_ar, icon };
}

/** Checks a create body (every field) or an update body (only the fields sent). */
function check(input: ProviderUpdateInput) {
  if (input.name !== undefined) checkText(input.name, 'name', 1, 100);
  if (input.area_name !== undefined) checkText(input.area_name, 'area_name', 1, 100);
  if (input.description !== undefined) checkText(input.description, 'description', 0, 2000);
  if (input.price_text != null) checkText(input.price_text, 'price_text', 0, 100);
  checkPhone(input.phone, 'phone');
  checkPhone(input.whatsapp, 'whatsapp');
  if ((input.photos ?? []).length > 10) throw new ApiError(422, 'At most 10 photos');
  checkHours(input.opening_hours);
}

let created = 0;

/** POST /me/provider: a new listing, public without the badge. */
export function buildOwnProvider(input: ProviderCreateInput): OwnProvider {
  check(input);
  created += 1;
  const proof = input.verification_doc_url || null;
  const hours = input.opening_hours ?? null;
  return {
    id: `00000000-0000-4000-a000-${String(Date.now()).slice(-10).padStart(10, '0')}${String(created).padStart(2, '0')}`,
    slug: `new${created}`,
    name: input.name.trim(),
    category: categoryRef(input.category_id),
    area_name: input.area_name.trim(),
    price_text: input.price_text?.trim() || null,
    avg_rating: 0,
    review_count: 0,
    verified: false,
    claimed: true,
    founding_member: false,
    featured: false,
    lat: input.lat,
    lng: input.lng,
    distance_m: null,
    cover_photo_url: input.photos[0] ?? null,
    open_now: isOpenAt(hours, new Date()),
    sponsored: false,
    sponsor_hook: null,
    has_active_story: false,
    banner_title: null,
    description: input.description.trim(),
    phone: input.phone,
    // The backend always answers with a WhatsApp number, falling back to the phone.
    whatsapp: input.whatsapp ?? input.phone,
    photos: input.photos,
    created_at: new Date().toISOString(),
    opening_hours: hours,
    contacts_this_month: input.show_contact_count ? 0 : null,
    active_banner: null,
    follower_count: 0,
    is_following: false,
    status: proof ? 'pending' : 'unverified',
    featured_until: null,
    verification_doc_url: proof,
    show_contact_count: input.show_contact_count ?? false,
  };
}

/** PATCH /me/provider: the fields sent replace the old ones; the proof follows the status rules. */
export function applyOwnEdits(own: OwnProvider, input: ProviderUpdateInput): OwnProvider {
  check(input);
  const next: OwnProvider = { ...own };
  if (input.name !== undefined) next.name = input.name.trim();
  if (input.category_id !== undefined) next.category = categoryRef(input.category_id);
  if (input.description !== undefined) next.description = input.description.trim();
  if (input.price_text !== undefined) next.price_text = input.price_text?.trim() || null;
  if (input.phone !== undefined) next.phone = input.phone;
  if (input.whatsapp !== undefined || input.phone !== undefined) {
    next.whatsapp = input.whatsapp !== undefined ? (input.whatsapp ?? next.phone) : next.whatsapp;
  }
  if (input.lat !== undefined) next.lat = input.lat;
  if (input.lng !== undefined) next.lng = input.lng;
  if (input.area_name !== undefined) next.area_name = input.area_name.trim();
  if (input.photos !== undefined) {
    next.photos = input.photos;
    next.cover_photo_url = input.photos[0] ?? null;
  }
  if (input.opening_hours !== undefined) {
    next.opening_hours = input.opening_hours;
    next.open_now = isOpenAt(input.opening_hours, new Date());
  }
  if (input.show_contact_count !== undefined) {
    next.show_contact_count = input.show_contact_count;
    next.contacts_this_month = input.show_contact_count ? (own.contacts_this_month ?? 0) : null;
  }
  if (input.sponsor_hook !== undefined) next.sponsor_hook = input.sponsor_hook?.trim() || null;
  if (input.verification_doc_url !== undefined) {
    const proof = input.verification_doc_url || null;
    if (own.status === 'unverified' && proof && proof !== own.verification_doc_url) next.status = 'pending';
    else if (own.status === 'pending' && !proof) next.status = 'unverified';
    next.verification_doc_url = proof;
  }
  return next;
}

/** GET /me/provider/stats. A listing made in this session starts at zero. */
export function mockStats(fresh: boolean): ProviderStats {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return fresh ? { month, views: 0, whatsapp: 0, calls: 0 } : { month, views: 148, whatsapp: 23, calls: 9 };
}
