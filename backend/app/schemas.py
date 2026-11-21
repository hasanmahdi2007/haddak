"""Pydantic schemas: the JSON shapes from docs/API.md.

"...Out" / Summary / Detail classes describe responses.
"...Create" / "...Update" / "...In" classes describe and validate request bodies.
"""

import re
import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# International format: a plus sign followed by 8 to 15 digits.
PHONE_PATTERN = re.compile(r"^\+\d{8,15}$")


def check_phone(value: str | None) -> str | None:
    if value is not None and not PHONE_PATTERN.match(value):
        raise ValueError("must be in international format: + and 8 to 15 digits")
    return value


def check_photo_urls(urls: list[str] | None) -> list[str] | None:
    for url in urls or []:
        if not url.startswith(("http://", "https://")):
            raise ValueError("each photo must be an http(s) URL")
    return urls


# ----- Opening hours -----
# Example: {"mon": [["09:00", "13:00"], ["15:00", "19:00"]], "sat": [["10:00", "14:00"]]}
# Pydantic checks the shape from these type descriptions:
#   - only the seven day names are accepted as keys,
#   - each day has at most 3 ranges,
#   - each range is exactly two "HH:MM" texts between 00:00 and 23:59.
DayName = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
ClockTime = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
DayRanges = Annotated[list[tuple[ClockTime, ClockTime]], Field(max_length=3)]
OpeningHours = dict[DayName, DayRanges]


def check_opening_hours(hours: dict | None) -> dict | None:
    """The one rule the types above cannot express: open comes before close.

    No overnight ranges in v1: ["22:00", "02:00"] is rejected, because a
    range may not cross midnight. "HH:MM" texts of equal length compare
    correctly as plain strings, so no time parsing is needed.
    """
    for day, ranges in (hours or {}).items():
        for open_time, close_time in ranges:
            if open_time >= close_time:
                raise ValueError(
                    f"{day}: open ({open_time}) must be before close ({close_time}); "
                    "ranges cannot cross midnight"
                )
    return hours


# ----- Structured prices -----
# What a price is for, and its currency. Search filters on these.
PriceUnit = Literal["hour", "visit", "job", "item", "month"]
PriceCurrency = Literal["USD", "LBP"]
# Upper bound only to catch typos (an extra zero or two); LBP prices are big.
MAX_PRICE_AMOUNT = 100_000_000


def check_price_pair(amount: float | None, unit: str | None) -> None:
    """price_amount and price_unit go together: both set or both empty."""
    if (amount is None) != (unit is None):
        raise ValueError("price_amount and price_unit must be sent together")


def blank_to_none(value: object) -> object:
    """Runs before the normal checks: "" or "   " is treated like null.

    Lets the app send an empty text box as it is for optional texts."""
    if isinstance(value, str) and not value.strip():
        return None
    return value


def check_https_url(value: str | None) -> str | None:
    if value is not None and not value.startswith("https://"):
        raise ValueError("must be an https:// URL")
    return value


def check_lat_lng_together(lat: float | None, lng: float | None) -> None:
    if (lat is None) != (lng is None):
        raise ValueError("lat and lng must be sent together")


def reject_nulls(model: BaseModel, required_fields: set[str]) -> None:
    """For PATCH bodies: a field may be left out, but these may not be null."""
    for name in required_fields & model.model_fields_set:
        if getattr(model, name) is None:
            raise ValueError(f"{name} cannot be null")


# ---------- Categories ----------


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name_en: str
    name_ar: str
    icon: str
    parent_id: int | None
    sort_order: int


class CategoryBrief(BaseModel):
    """The small category object embedded in every provider."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name_en: str
    name_ar: str
    icon: str


# ---------- Stories and banners (responses) ----------
# These come before the provider shapes because ProviderDetail contains a banner.


class StoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider_id: uuid.UUID
    text: str
    image_url: str | None
    created_at: datetime
    expires_at: datetime


class StoryList(BaseModel):
    items: list[StoryOut]


class BannerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    text: str | None
    discount_percent: int | None
    starts_at: datetime
    expires_at: datetime


# ---------- Providers (responses) ----------


class ProviderSummary(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: CategoryBrief
    area_name: str
    price_text: str | None
    # Structured price; amount and unit are both None when not given.
    price_amount: float | None
    price_unit: str | None
    price_currency: str
    avg_rating: float
    review_count: int
    verified: bool  # True only for status 'verified': the founder checked proof
    claimed: bool  # False for a listing with no owner ("listed by the community")
    founding_member: bool
    featured: bool
    lat: float
    lng: float
    distance_m: int | None
    cover_photo_url: str | None
    open_now: bool | None  # None when the provider gave no opening hours
    # The owner switched on "Available now" and it has not run out yet.
    available_now: bool
    # What users see as "Sponsored": the same value as `featured`.
    sponsored: bool
    sponsor_hook: str | None  # always None unless sponsored
    has_active_story: bool
    banner_title: str | None  # title of the active banner, if there is one
    # 'osm' for a listing imported from OpenStreetMap (the app then shows
    # "Data © OpenStreetMap contributors"), otherwise None.
    data_source: Literal["osm"] | None


class ProviderDetail(ProviderSummary):
    description: str
    # Both None only for an OpenStreetMap listing that came without a number.
    phone: str | None
    whatsapp: str | None
    photos: list[str]
    created_at: datetime
    opening_hours: dict[str, list[list[str]]] | None
    # whatsapp + call taps in the current UTC month. None unless the provider
    # switched on show_contact_count.
    contacts_this_month: int | None
    active_banner: BannerOut | None
    follower_count: int
    is_following: bool  # False for anonymous callers
    # "Yes, I hired them" answers in the last 90 days (see services/hire_checks.py).
    confirmed_hires: int


class OwnProvider(ProviderDetail):
    """What the owner (and the admin) sees: includes the private fields.

    Here sponsor_hook is the stored text even when the profile is not
    sponsored, so the owner can read and edit it.
    """

    status: str
    source: str  # 'owner', 'suggestion' or 'osm'
    featured_until: date | None
    verification_doc_url: str | None
    show_contact_count: bool
    available_until: datetime | None  # when "Available now" turns itself off


class ProviderSearchResult(BaseModel):
    items: list[ProviderSummary]
    total: int


class AdminProvider(OwnProvider):
    """What the admin list shows: OwnProvider plus founder-only numbers."""

    # "They didn't answer" replies in the last 90 days. Never shown to the
    # provider or the public.
    no_answer_count_90d: int


class AdminProviderList(BaseModel):
    items: list[AdminProvider]
    total: int


class StoryGroup(BaseModel):
    """One provider and its active stories, newest story first."""

    provider: ProviderSummary
    stories: list[StoryOut]


class StoryGroupList(BaseModel):
    items: list[StoryGroup]


class AvailableIn(BaseModel):
    """Body of PUT /me/provider/available: how long "Available now" lasts."""

    # Only three choices, so a forgotten switch never stays on for long.
    hours: Literal[2, 4, 8]


class ProviderStats(BaseModel):
    month: str  # e.g. "2026-11"
    views: int
    whatsapp: int
    calls: int
    confirmed_hires: int  # last 90 days, not just this month


# ---------- Providers (requests) ----------


class ProviderCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    category_id: int
    description: str = Field(default="", max_length=2000)
    price_text: str | None = Field(default=None, max_length=100)
    phone: str
    whatsapp: str | None = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    area_name: str = Field(min_length=1, max_length=100)
    photos: list[str] = Field(default_factory=list, max_length=10)
    verification_doc_url: str | None = Field(default=None, max_length=1000)
    show_contact_count: bool = False
    opening_hours: OpeningHours | None = None
    sponsor_hook: str | None = Field(default=None, max_length=80)
    price_amount: float | None = Field(default=None, gt=0, le=MAX_PRICE_AMOUNT)
    price_unit: PriceUnit | None = None
    price_currency: PriceCurrency = "USD"

    _blank_hook = field_validator("sponsor_hook", mode="before")(blank_to_none)
    _phones = field_validator("phone", "whatsapp")(check_phone)
    _photos = field_validator("photos")(check_photo_urls)
    _hours = field_validator("opening_hours")(check_opening_hours)

    @model_validator(mode="after")
    def price_amount_and_unit_together(self) -> "ProviderCreate":
        check_price_pair(self.price_amount, self.price_unit)
        return self


class ProviderUpdate(BaseModel):
    """PATCH body: the same fields as ProviderCreate, all optional."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    category_id: int | None = None
    description: str | None = Field(default=None, max_length=2000)
    price_text: str | None = Field(default=None, max_length=100)
    phone: str | None = None
    whatsapp: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    area_name: str | None = Field(default=None, min_length=1, max_length=100)
    photos: list[str] | None = Field(default=None, max_length=10)
    verification_doc_url: str | None = Field(default=None, max_length=1000)
    show_contact_count: bool | None = None
    opening_hours: OpeningHours | None = None
    sponsor_hook: str | None = Field(default=None, max_length=80)
    # price_amount and price_unit may be cleared with null (both together);
    # whether the pair still matches after the update is checked in the
    # router, because one of them may already be stored.
    price_amount: float | None = Field(default=None, gt=0, le=MAX_PRICE_AMOUNT)
    price_unit: PriceUnit | None = None
    price_currency: PriceCurrency | None = None

    _blank_hook = field_validator("sponsor_hook", mode="before")(blank_to_none)
    _phones = field_validator("phone", "whatsapp")(check_phone)
    _photos = field_validator("photos")(check_photo_urls)
    _hours = field_validator("opening_hours")(check_opening_hours)

    @model_validator(mode="after")
    def required_fields_not_null(self) -> "ProviderUpdate":
        # price_text, whatsapp, verification_doc_url, opening_hours,
        # sponsor_hook, price_amount and price_unit may be cleared with null.
        reject_nulls(
            self,
            {
                "name",
                "category_id",
                "description",
                "phone",
                "lat",
                "lng",
                "area_name",
                "photos",
                "show_contact_count",
                "price_currency",
            },
        )
        return self


# The four statuses; their meaning is described at the top of models.py.
ProviderStatus = Literal["unverified", "pending", "verified", "rejected"]


class AdminProviderUpdate(BaseModel):
    status: ProviderStatus | None = None
    founding_member: bool | None = None
    featured_until: date | None = None  # null removes "featured"
    # The admin can correct a structured price (same rules as the owner's).
    price_amount: float | None = Field(default=None, gt=0, le=MAX_PRICE_AMOUNT)
    price_unit: PriceUnit | None = None
    price_currency: PriceCurrency | None = None

    @model_validator(mode="after")
    def required_fields_not_null(self) -> "AdminProviderUpdate":
        reject_nulls(self, {"status", "founding_member", "price_currency"})
        return self


class ContactEventIn(BaseModel):
    type: Literal["view", "whatsapp", "call"]


# ---------- Stories and banners (requests) ----------


class StoryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=280)
    image_url: str | None = Field(default=None, max_length=1000)

    _blank_image = field_validator("image_url", mode="before")(blank_to_none)
    _https_image = field_validator("image_url")(check_https_url)


class BannerIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=60)
    text: str | None = Field(default=None, max_length=200)
    discount_percent: int | None = Field(default=None, ge=1, le=90)
    # How long the banner runs, starting now.
    days: int = Field(default=7, ge=1, le=7)

    _blank_text = field_validator("text", mode="before")(blank_to_none)


# ---------- Reviews ----------


class ReviewIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)
    author_name: str = Field(min_length=1, max_length=80)


class ReviewOut(BaseModel):
    id: uuid.UUID
    author_name: str
    rating: int
    comment: str
    created_at: datetime
    is_mine: bool
    # True when the author answered "Yes, I hired them" for this provider.
    hired_through_haddak: bool


class ReviewList(BaseModel):
    items: list[ReviewOut]
    total: int


# ---------- "Did you hire them?" ----------

HireAnswer = Literal["hired", "not_yet", "no_answer"]


class HireAnswerIn(BaseModel):
    answer: HireAnswer


class HireCheckOut(BaseModel):
    id: uuid.UUID
    contact_type: str  # 'whatsapp' or 'call'
    contacted_at: datetime
    provider: ProviderSummary


class HireCheckList(BaseModel):
    items: list[HireCheckOut]


# ---------- Suggestions ----------


class SuggestionIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    phone: str | None = None
    category_id: int | None = None
    area_name: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=500)
    # Optional position of the suggested provider: both or neither.
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)

    _phone = field_validator("phone")(check_phone)

    @model_validator(mode="after")
    def lat_and_lng_together(self) -> "SuggestionIn":
        check_lat_lng_together(self.lat, self.lng)
        return self


class SuggestionCreated(BaseModel):
    id: uuid.UUID


class SuggestionPublish(BaseModel):
    """Admin body for publishing a suggestion as a listing.

    Every field is optional: a value here replaces the suggestion's value,
    a field left out (or null) keeps it. Whether everything needed is there
    is checked after merging, in routers/admin.py.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = None
    category_id: int | None = None
    area_name: str | None = Field(default=None, min_length=1, max_length=100)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    description: str | None = Field(default=None, max_length=2000)

    _phone = field_validator("phone")(check_phone)


class SuggestionOut(BaseModel):
    """What the admin sees."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str | None
    category: CategoryBrief | None
    area_name: str | None
    note: str | None
    lat: float | None
    lng: float | None
    created_at: datetime


class SuggestionList(BaseModel):
    items: list[SuggestionOut]
    total: int


# ---------- Reports ----------

# remove_my_business: "This is my business and I want it removed" (for
# listings added without the owner, e.g. OpenStreetMap imports).
ReportReason = Literal[
    "wrong_info", "not_real", "closed", "offensive", "remove_my_business", "other"
]


class ReportIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: ReportReason
    note: str | None = Field(default=None, max_length=500)


class ReportCreated(BaseModel):
    id: uuid.UUID


class ReportedProvider(BaseModel):
    """The few provider fields the admin needs next to a report."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: str


class ReportOut(BaseModel):
    """What the admin sees."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reason: str
    note: str | None
    created_at: datetime
    provider: ReportedProvider


class ReportList(BaseModel):
    items: list[ReportOut]
    total: int


# ---------- Claims ("Is this your business? Claim it") ----------

ClaimStatus = Literal["pending", "approved", "rejected"]


class ClaimIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str | None = Field(default=None, max_length=500)
    verification_doc_url: str | None = Field(default=None, max_length=1000)

    @field_validator("message", "verification_doc_url")
    @classmethod
    def empty_is_none(cls, value: str | None) -> str | None:
        # An empty box in the app means "nothing", not an empty text.
        return value or None


class ClaimOut(BaseModel):
    """What the claimer gets back."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider_id: uuid.UUID
    status: str
    created_at: datetime


class AdminClaimOut(ClaimOut):
    """What the admin sees: the claimer, their message and proof, and the listing."""

    user_id: uuid.UUID
    message: str | None
    verification_doc_url: str | None
    decided_at: datetime | None
    provider: ReportedProvider  # id, name and status, like next to a report


class AdminClaimList(BaseModel):
    items: list[AdminClaimOut]
    total: int


class AdminStoryOut(BaseModel):
    """An active story as the admin sees it, with the provider's name."""

    id: uuid.UUID
    provider_id: uuid.UUID
    provider_name: str
    text: str
    image_url: str | None
    created_at: datetime
    expires_at: datetime


class AdminStoryList(BaseModel):
    items: list[AdminStoryOut]


class AdminBannerOut(BaseModel):
    """An active banner as the admin sees it. A banner has no id of its own:
    provider_id identifies it (DELETE /admin/providers/{provider_id}/banner)."""

    provider_id: uuid.UUID
    provider_name: str
    title: str
    text: str | None
    discount_percent: int | None
    starts_at: datetime
    expires_at: datetime


class AdminBannerList(BaseModel):
    items: list[AdminBannerOut]


# ---------- Assistant (POST /assist, see docs/AI_ASSISTANT.md) ----------

SortChoice = Literal["best", "distance", "price"]
AssistKind = Literal["results", "clarify", "emergency", "off_topic", "unavailable"]


class PlaceOut(BaseModel):
    """A place the search was centred on."""

    slug: str
    name_en: str
    name_ar: str
    lat: float
    lng: float


class PlaceOption(BaseModel):
    """One of several places that share a name, for the user to choose."""

    slug: str
    name_en: str
    name_ar: str
    district: str


class Understood(BaseModel):
    """The search settings the assistant settled on (after the backend's checks)."""

    category_slugs: list[str]
    q: str | None
    place: PlaceOut | None
    radius_m: int  # 500, 1000, 5000 or 20000
    max_price: float | None
    price_unit: PriceUnit | None
    price_currency: PriceCurrency
    open_now: bool
    sort: SortChoice


class PlaceRefIn(BaseModel):
    """A place sent back by the app: only the slug counts (other fields that
    the app echoes back, like the coordinates, are ignored)."""

    slug: str = Field(min_length=1, max_length=100)


class UnderstoodIn(BaseModel):
    """The `understood` request form: settings the app got from us earlier
    (a clarify option, or a place button). Checked again like AI output."""

    model_config = ConfigDict(str_strip_whitespace=True)

    category_slugs: list[str] = Field(default_factory=list, max_length=10)
    q: str | None = Field(default=None, max_length=60)
    place: PlaceRefIn | None = None
    radius_m: int = Field(default=1000, ge=100, le=50000)
    max_price: float | None = Field(default=None, gt=0, le=MAX_PRICE_AMOUNT)
    price_unit: PriceUnit | None = None
    price_currency: PriceCurrency = "USD"
    open_now: bool = False
    sort: SortChoice = "best"


class AssistIn(BaseModel):
    """Either `text` (a sentence) or `understood` (settings), not both."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str | None = Field(default=None, min_length=2, max_length=300)
    understood: UnderstoodIn | None = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    lang: Literal["ar", "en"] = "en"  # language of `summary`

    @model_validator(mode="after")
    def text_or_understood(self) -> "AssistIn":
        if (self.text is None) == (self.understood is None):
            raise ValueError("send either text or understood")
        return self


class ClarifyOptionOut(BaseModel):
    label: str
    understood: Understood


class ClarifyQuestionOut(BaseModel):
    text: str
    options: list[ClarifyOptionOut]


class AssistOut(BaseModel):
    kind: AssistKind
    understood: Understood | None
    summary: str  # built by our own templates, never by the AI
    results: ProviderSearchResult | None
    widened: bool  # nothing was found, so the radius was made bigger
    question: ClarifyQuestionOut | None
    place_options: list[PlaceOption] | None
    place_unknown: str | None
    whatsapp_draft: str | None


class WantedItem(BaseModel):
    text: str
    count: int
    last_seen: datetime


class UnknownPlaceItem(BaseModel):
    name: str
    count: int


class AssistWanted(BaseModel):
    """GET /admin/assist/wanted: what people asked for and did not find."""

    month: str  # e.g. "2026-11"
    month_spend_usd: float
    month_budget_usd: float
    month_ai_requests: int
    items: list[WantedItem]
    unknown_places: list[UnknownPlaceItem]
