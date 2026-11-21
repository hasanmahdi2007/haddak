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
  /** Haddak checked proof of this provider's work. */
  verified: boolean;
  /** False: listed from someone's suggestion, and no owner has taken the listing yet. */
  claimed: boolean;
  founding_member: boolean;
  featured: boolean;
  lat: number;
  lng: number;
  /** Null in ProviderDetail unless lat and lng were passed. */
  distance_m: number | null;
  cover_photo_url: string | null;
  /** Open at this moment (Lebanon time). Null when the provider gave no opening hours. */
  open_now: boolean | null;
  /** The owner switched on "Available now" and it has not run out yet. */
  available_now: boolean;
  /** Paid placement: shown in the "Sponsored" section above the results. */
  sponsored: boolean;
  /** One line written by the sponsor, shown on the sponsored card. */
  sponsor_hook: string | null;
  /** The provider posted an update that has not expired yet. */
  has_active_story: boolean;
  /** Title of the offer running now, or null. */
  banner_title: string | null;
  /**
   * 'osm': imported from OpenStreetMap; the profile shows "Data © OpenStreetMap contributors".
   * Optional: older backends do not send it.
   */
  data_source?: 'osm' | null;
  /**
   * Structured price, used by the price filter (docs/AI_ASSISTANT.md, "Prices").
   * Optional: older backends do not send them, and most providers have only `price_text`.
   */
  price_amount?: number | null;
  price_unit?: PriceUnit | null;
  price_currency?: PriceCurrency | null;
}

/** What a structured price is counted in. */
export type PriceUnit = 'hour' | 'visit' | 'job' | 'item' | 'month';
export type PriceCurrency = 'USD' | 'LBP';
/** Search order: `best` (the normal ranking), `distance` (nearest first), `price` (cheapest first). */
export type SearchSort = 'best' | 'distance' | 'price';

/** A short update posted by a provider. It disappears at `expires_at`. */
export interface Story {
  id: string;
  provider_id: string;
  text: string;
  image_url: string | null;
  created_at: string;
  expires_at: string;
}

/** An offer a provider runs for a limited time, shown on the profile. */
export interface Banner {
  title: string;
  text: string | null;
  discount_percent: number | null;
  starts_at: string;
  expires_at: string;
}

/** One provider and their active stories, newest first. */
export interface StoryGroup {
  provider: ProviderSummary;
  stories: Story[];
}

export interface NearbyStoriesParams {
  lat: number;
  lng: number;
  radius_m: number;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** One opening period: 24-hour "HH:MM" strings, open before close, never across midnight. */
export type TimeRange = [open: string, close: string];

/** A missing day (or an empty list) means closed that day. */
export type OpeningHours = Partial<Record<DayKey, TimeRange[]>>;

export interface ProviderDetail extends ProviderSummary {
  description: string;
  /** Null only for an OpenStreetMap listing that came without a number: no WhatsApp or Call then. */
  phone: string | null;
  /** Null means "same as phone". */
  whatsapp: string | null;
  photos: string[];
  created_at: string;
  /** Null means the provider did not give opening hours. */
  opening_hours: OpeningHours | null;
  /** WhatsApp taps and calls this month. Null unless the provider chose to show it. */
  contacts_this_month: number | null;
  active_banner: Banner | null;
  follower_count: number;
  /** Always false while signed out. */
  is_following: boolean;
  /** "Yes, I hired them" answers in the last 90 days. */
  confirmed_hires: number;
}

/** `unverified`: no proof sent yet; `pending`: proof waiting for the founder. */
export type ProviderStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

/** How long "Available now" lasts once switched on. */
export type AvailableHours = 2 | 4 | 8;

export interface OwnProvider extends ProviderDetail {
  status: ProviderStatus;
  featured_until: string | null;
  verification_doc_url: string | null;
  /** The owner's choice to show `contacts_this_month` publicly. */
  show_contact_count: boolean;
  /** When "Available now" turns itself off; null when it is off. */
  available_until: string | null;
}

export interface Review {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
  is_mine: boolean;
  /** The author told Haddak they hired this provider. */
  hired_through_haddak: boolean;
}

/** "Did you hire them?" answers. `no_answer`: the provider did not pick up. */
export type HireAnswer = 'hired' | 'not_yet' | 'no_answer';

/** A question the app asks some hours after a WhatsApp or Call tap. */
export interface HireCheck {
  id: string;
  contact_type: 'whatsapp' | 'call';
  contacted_at: string;
  provider: ProviderSummary;
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
  /** Also return providers Haddak has not verified. Default false. */
  include_unverified?: boolean;
  /** Keeps providers whose structured price is at most this. Needs `price_unit`. */
  max_price?: number;
  price_unit?: PriceUnit;
  /** Default USD. */
  price_currency?: PriceCurrency;
  /** Keeps providers whose opening hours say open now, or who are marked "Available now". */
  open_now?: boolean;
  /** Keeps only providers marked "Available now". */
  available_now?: boolean;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// The assistant (POST /assist, docs/API.md and docs/AI_ASSISTANT.md)
// ---------------------------------------------------------------------------

/** A place from the backend's own `places` table, after the lookup. */
export interface Place {
  slug: string;
  name_en: string;
  name_ar: string;
  lat: number;
  lng: number;
}

/** One of two places that share a name: the app shows each as a button. */
export interface PlaceOption {
  slug: string;
  name_en: string;
  name_ar: string;
  district: string;
}

/** Search settings, as understood from a sentence and checked by the backend. */
export interface Understood {
  /** Only slugs that exist; may be empty when `q` is set. */
  category_slugs: string[];
  q: string | null;
  /** Null: search around the phone. */
  place: Place | null;
  /** 500, 1000, 5000 or 20000. */
  radius_m: number;
  max_price: number | null;
  price_unit: PriceUnit | null;
  price_currency: PriceCurrency;
  open_now: boolean;
  sort: SearchSort;
}

/**
 * What the app may send back as `understood`. Choosing between two places
 * (`place_options`) only knows the slug, so `place` may be just `{ slug }`:
 * the backend looks the slug up in its `places` table.
 */
export type UnderstoodInput = Omit<Understood, 'place'> & {
  place: Place | { slug: string } | null;
};

/** A clarify option is already a full set of search settings. */
export interface ClarifyOption {
  label: string;
  understood: Understood;
}

export interface ClarifyQuestion {
  text: string;
  options: ClarifyOption[];
}

export type AssistKind = 'results' | 'clarify' | 'emergency' | 'off_topic' | 'unavailable';

/** Body of POST /assist: a sentence, or a chosen option (no AI request is made). */
export type AssistRequest = Coordinates & { lang: 'en' | 'ar' } & (
    | { text: string }
    | { understood: UnderstoodInput }
  );

export interface AssistResponse {
  kind: AssistKind;
  understood: Understood | null;
  /** "Plumber · near you · 1 km", built from a template in `lang`. */
  summary: string | null;
  results: Page<ProviderSummary> | null;
  /** Nothing was found, so the radius was widened once (1 km → 5 km → 20 km). */
  widened: boolean;
  question: ClarifyQuestion | null;
  place_options: PlaceOption[] | null;
  /** A place name that was not found; the search used the phone location. */
  place_unknown: string | null;
  /** A short first message for WhatsApp in the user's language, or null. */
  whatsapp_draft: string | null;
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
  /** Show `contacts_this_month` on the public profile. Default false. */
  show_contact_count?: boolean;
  /** Null (the default) means "hours not given". */
  opening_hours?: OpeningHours | null;
}

export type ProviderUpdateInput = Partial<ProviderCreateInput> & {
  /** One sentence, 1 to 80 characters, shown only while sponsored. Null or "" clears it. */
  sponsor_hook?: string | null;
};

/** Body of POST /me/provider/stories. */
export interface StoryInput {
  /** 1 to 280 characters. */
  text: string;
  /** Optional; must start with https://. Null means none. */
  image_url?: string | null;
}

/** Body of PUT /me/provider/banner. */
export interface BannerInput {
  /** 1 to 60 characters. */
  title: string;
  /** Up to 200 characters; null means none. */
  text?: string | null;
  /** 1 to 90; null means no figure. */
  discount_percent?: number | null;
  /** 1 to 7, default 7. */
  days?: number;
}

export interface FollowingParams {
  limit?: number;
  offset?: number;
}

export interface ProviderStats {
  /** "YYYY-MM" */
  month: string;
  views: number;
  whatsapp: number;
  calls: number;
  /** Last 90 days, not just this month. */
  confirmed_hires: number;
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

/** Why a listing is reported (POST /providers/{id}/reports). */
export type ReportReason = 'wrong_info' | 'not_real' | 'closed' | 'offensive' | 'remove_my_business' | 'other';

/** Body of POST /providers/{id}/reports. Nothing about the sender is stored. */
export interface ReportInput {
  reason: ReportReason;
  /** Up to 500 characters. */
  note?: string | null;
}

/** Body of POST /providers/{id}/claim ("Is this your business? Claim it"). Both optional. */
export interface ClaimInput {
  /** Up to 500 characters. */
  message?: string | null;
  /** Signed link to a proof photo in the private `verification-docs` bucket. */
  verification_doc_url?: string | null;
}

/** A claim as the claimer sees it. The founder approves or rejects it. */
export interface Claim {
  id: string;
  provider_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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
  /** A provider's active stories, newest first. */
  getProviderStories(providerId: string): Promise<{ items: Story[] }>;
  /** Providers around a point who have active stories (at most 30). */
  getNearbyStories(params: NearbyStoriesParams): Promise<{ items: StoryGroup[] }>;
  logContactEvent(providerId: string, type: ContactEventType): Promise<void>;
  /** Suggest a provider who is not on Haddak yet. 429 after 5 in an hour. */
  submitSuggestion(input: SuggestionInput): Promise<{ id: string }>;
  /** Flag a bad listing. No login. 429 after 10 in an hour. */
  reportProvider(providerId: string, input: ReportInput): Promise<{ id: string }>;
  /** The assistant: a sentence (or a chosen option) in, search settings and results out. 429 after 30 a day. */
  assist(request: AssistRequest): Promise<AssistResponse>;

  // Auth endpoints: they need a signed-in user (401 otherwise).
  /** My review of this provider, or null if I have not written one. */
  getMyReview(providerId: string): Promise<Review | null>;
  /** 403 on my own listing. */
  upsertMyReview(providerId: string, input: ReviewInput): Promise<Review>;
  deleteMyReview(providerId: string): Promise<void>;
  /** Deletes my account and everything kept about me. 204, also when called twice. */
  deleteMyAccount(): Promise<void>;
  getMyProvider(): Promise<OwnProvider>;
  createMyProvider(input: ProviderCreateInput): Promise<OwnProvider>;
  updateMyProvider(input: ProviderUpdateInput): Promise<OwnProvider>;
  getMyProviderStats(): Promise<ProviderStats>;
  /** 403 while my profile is not verified; 409 with 5 active stories already. */
  postMyStory(input: StoryInput): Promise<Story>;
  deleteMyStory(storyId: string): Promise<void>;
  /** Replaces the banner I had. 403 while not verified. */
  setMyBanner(input: BannerInput): Promise<Banner>;
  deleteMyBanner(): Promise<void>;
  /** Switch on "Available now" for 2, 4 or 8 hours. */
  setMyAvailable(hours: AvailableHours): Promise<OwnProvider>;
  /** Switch "Available now" off. */
  clearMyAvailable(): Promise<void>;
  followProvider(providerId: string): Promise<void>;
  unfollowProvider(providerId: string): Promise<void>;
  /** Providers I follow, most recently followed first. */
  getMyFollowing(params?: FollowingParams): Promise<Page<ProviderSummary>>;
  /** Active stories of the verified providers I follow (at most 30 providers). */
  getMyFeed(): Promise<{ items: StoryGroup[] }>;
  /** My unanswered "Did you hire them?" questions (12 hours to 14 days old), newest first, at most 3. */
  getPendingHireChecks(): Promise<{ items: HireCheck[] }>;
  /** Answer once. 404 if not mine, 409 if already answered. */
  answerHireCheck(checkId: string, answer: HireAnswer): Promise<void>;
  /**
   * Ask to own a listing nobody owns. 409 if it has an owner, if I already have a
   * profile, or if I already asked. 429 after 5 in an hour.
   */
  claimProvider(providerId: string, input: ClaimInput): Promise<Claim>;
}
