/**
 * Types for every shape in docs/API.md. Field names are snake_case on purpose:
 * they are the wire format, and the app does not rename them.
 */

export type CategoryIcon = string;

export interface Category {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  /** Icon key; mapped to a glyph in src/components/CategoryIcon.tsx. */
  icon: CategoryIcon;
  parent_id: number | null;
  sort_order: number;
}

/** The category object embedded in a provider (no parent_id / sort_order). */
export interface CategoryRef {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  icon: CategoryIcon;
}

export interface ProviderSummary {
  id: string;
  slug: string;
  name: string;
  category: CategoryRef;
  area_name: string;
  price_text: string | null;
  avg_rating: number;
  review_count: number;
  verified: boolean;
  founding_member: boolean;
  featured: boolean;
  lat: number;
  lng: number;
  /** Null in ProviderDetail unless lat and lng were passed. */
  distance_m: number | null;
  cover_photo_url: string | null;
  /** Open at this moment (Lebanon time). Null when the provider gave no opening hours. */
  open_now: boolean | null;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** One opening period: 24-hour "HH:MM" strings, open before close, never across midnight. */
export type TimeRange = [open: string, close: string];

/** A missing day (or an empty list) means closed that day. */
export type OpeningHours = Partial<Record<DayKey, TimeRange[]>>;

export interface ProviderDetail extends ProviderSummary {
  description: string;
  phone: string;
  /** Null means "same as phone". */
  whatsapp: string | null;
  photos: string[];
  created_at: string;
  /** Null means the provider did not give opening hours. */
  opening_hours: OpeningHours | null;
  /** WhatsApp taps and calls this month. Null unless the provider chose to show it. */
  contacts_this_month: number | null;
}

export type ProviderStatus = 'pending' | 'verified' | 'rejected';

export interface OwnProvider extends ProviderDetail {
  status: ProviderStatus;
  featured_until: string | null;
  verification_doc_url: string | null;
}

export interface Review {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
  is_mine: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export type ContactEventType = 'view' | 'whatsapp' | 'call';

export interface HealthResponse {
  status: string;
}

export interface SearchParams {
  lat: number;
  lng: number;
  /** 100 to 50000. */
  radius_m: number;
  category_id?: number;
  /** 2 to 60 characters; keeps providers whose name contains it (case-insensitive). */
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ReviewListParams {
  limit?: number;
  offset?: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ReviewInput {
  rating: number;
  comment: string;
  author_name: string;
}

export interface ProviderCreateInput {
  name: string;
  category_id: number;
  description: string;
  price_text: string | null;
  phone: string;
  whatsapp: string | null;
  lat: number;
  lng: number;
  area_name: string;
  photos: string[];
  verification_doc_url: string | null;
}

export type ProviderUpdateInput = Partial<ProviderCreateInput>;

export interface ProviderStats {
  /** "YYYY-MM" */
  month: string;
  views: number;
  whatsapp: number;
  calls: number;
}

export interface AdminProviderPatch {
  status?: ProviderStatus;
  founding_member?: boolean;
  featured_until?: string | null;
}

/** Body of POST /suggestions. Only `name` is required. */
export interface SuggestionInput {
  /** 1 to 100 characters. */
  name: string;
  /** International format: "+" and 8 to 15 digits. */
  phone?: string;
  category_id?: number;
  /** Up to 100 characters. */
  area_name?: string;
  /** Up to 500 characters. */
  note?: string;
}

/** Error body: {"detail": "human-readable message"}. */
export class ApiError extends Error {
  status: number;
  /** Seconds to wait, from the Retry-After header of a 429 (too many requests). */
  retryAfterS: number | null;
  constructor(status: number, detail: string, retryAfterS: number | null = null) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterS = retryAfterS;
  }
}

/** The contract every client (HTTP or mock) implements. */
export interface HaddakApi {
  health(): Promise<HealthResponse>;
  getCategories(): Promise<Category[]>;
  searchProviders(params: SearchParams): Promise<Page<ProviderSummary>>;
  getProvider(id: string, from?: Coordinates): Promise<ProviderDetail>;
  getProviderBySlug(slug: string, from?: Coordinates): Promise<ProviderDetail>;
  getReviews(providerId: string, params?: ReviewListParams): Promise<Page<Review>>;
  logContactEvent(providerId: string, type: ContactEventType): Promise<void>;
  /** Suggest a provider who is not on Haddak yet. 429 after 5 in an hour. */
  submitSuggestion(input: SuggestionInput): Promise<{ id: string }>;

  // Auth endpoints. Typed and wired now; the screens that use them are tasks M6 and M7.
  upsertMyReview(providerId: string, input: ReviewInput): Promise<Review>;
  deleteMyReview(providerId: string): Promise<void>;
  getMyProvider(): Promise<OwnProvider>;
  createMyProvider(input: ProviderCreateInput): Promise<OwnProvider>;
  updateMyProvider(input: ProviderUpdateInput): Promise<OwnProvider>;
  getMyProviderStats(): Promise<ProviderStats>;
}
