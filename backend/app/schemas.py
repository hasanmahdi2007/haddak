"""Pydantic schemas: the JSON shapes from docs/API.md.

"...Out" / Summary / Detail classes describe responses.
"...Create" / "...Update" / "...In" classes describe and validate request bodies.
"""

import re
import uuid
from datetime import date, datetime
from typing import Literal

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


# ---------- Providers (responses) ----------


class ProviderSummary(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: CategoryBrief
    area_name: str
    price_text: str | None
    avg_rating: float
    review_count: int
    verified: bool
    founding_member: bool
    featured: bool
    lat: float
    lng: float
    distance_m: int | None
    cover_photo_url: str | None


class ProviderDetail(ProviderSummary):
    description: str
    phone: str
    whatsapp: str
    photos: list[str]
    created_at: datetime


class OwnProvider(ProviderDetail):
    """What the owner (and the admin) sees: includes the private fields."""

    status: str
    featured_until: date | None
    verification_doc_url: str | None


class ProviderSearchResult(BaseModel):
    items: list[ProviderSummary]
    total: int


class OwnProviderList(BaseModel):
    items: list[OwnProvider]
    total: int


class ProviderStats(BaseModel):
    month: str  # e.g. "2026-11"
    views: int
    whatsapp: int
    calls: int


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

    _phones = field_validator("phone", "whatsapp")(check_phone)
    _photos = field_validator("photos")(check_photo_urls)


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

    _phones = field_validator("phone", "whatsapp")(check_phone)
    _photos = field_validator("photos")(check_photo_urls)

    @model_validator(mode="after")
    def required_fields_not_null(self) -> "ProviderUpdate":
        # price_text, whatsapp and verification_doc_url may be cleared with null.
        reject_nulls(
            self,
            {"name", "category_id", "description", "phone", "lat", "lng", "area_name", "photos"},
        )
        return self


class AdminProviderUpdate(BaseModel):
    status: Literal["pending", "verified", "rejected"] | None = None
    founding_member: bool | None = None
    featured_until: date | None = None  # null removes "featured"

    @model_validator(mode="after")
    def required_fields_not_null(self) -> "AdminProviderUpdate":
        reject_nulls(self, {"status", "founding_member"})
        return self


class ContactEventIn(BaseModel):
    type: Literal["view", "whatsapp", "call"]


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


class ReviewList(BaseModel):
    items: list[ReviewOut]
    total: int
