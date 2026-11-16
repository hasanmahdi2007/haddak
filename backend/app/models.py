"""SQLAlchemy models. They mirror docs/SCHEMA.md, which is the source of truth.

The tables themselves are created by the Alembic migration, not by these
classes. If you change a table: change SCHEMA.md, add a migration, then
update the class here.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from geoalchemy2 import Geography, Geometry
from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    cast,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship

from app.db import Base

# Provider statuses (see "providers.status" in docs/SCHEMA.md):
#   unverified - listed publicly, no proof submitted or proof not accepted
#   pending    - listed publicly as not verified; proof waits for the founder
#   verified   - listed publicly with the badge
#   rejected   - hidden everywhere public
# The public may see every status in this tuple; only 'rejected' is left out.
PUBLIC_STATUSES = ("verified", "unverified", "pending")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name_en: Mapped[str] = mapped_column(Text)
    name_ar: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    # None = a listing nobody has claimed (published from a suggestion).
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    description: Mapped[str] = mapped_column(Text, server_default=text("''"))
    price_text: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(Text)
    whatsapp: Mapped[str | None] = mapped_column(Text)

    # GEOGRAPHY (not GEOMETRY) so PostGIS measures in real metres on the
    # Earth's surface. With GEOMETRY, distances would be in degrees.
    # spatial_index=False because the migration creates the GIST index itself.
    location = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False
    )
    area_name: Mapped[str] = mapped_column(Text)
    photos: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    verification_doc_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default=text("'unverified'"))
    founding_member: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    featured_until: Mapped[date | None] = mapped_column(Date)
    avg_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0"))
    review_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # The owner's choice: show "contacts this month" on the public profile.
    show_contact_count: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    # JSON like {"mon": [["09:00", "13:00"]], ...}; None = hours not provided.
    # The shape is described in docs/SCHEMA.md and validated in schemas.py.
    opening_hours: Mapped[dict | None] = mapped_column(JSONB)
    # Who created the listing: 'owner' (the provider, in the app) or
    # 'suggestion' (the admin published it from a suggestion).
    source: Mapped[str] = mapped_column(Text, server_default=text("'owner'"))
    # One-sentence pitch written by the owner. The public only receives it
    # while the provider is sponsored (verified + featured_until not passed).
    sponsor_hook: Mapped[str | None] = mapped_column(Text)
    # Structured price, so search can filter and sort by it. Amount and unit
    # are set together or both None; price_text stays the description.
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    price_unit: Mapped[str | None] = mapped_column(Text)  # hour, visit, job, item, month
    price_currency: Mapped[str] = mapped_column(Text, server_default=text("'USD'"))
    # "Available now" runs until this moment; None = switched off. Nothing
    # clears it when the time passes: every read compares it with now.
    available_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Not real columns: whenever a provider is loaded, the database also
    # computes latitude and longitude from `location`, so Python code can
    # simply read provider.lat and provider.lng.
    lat: Mapped[float] = column_property(func.ST_Y(cast(location, Geometry)))
    lng: Mapped[float] = column_property(func.ST_X(cast(location, Geometry)))

    # Loaded together with the provider in the same query (a JOIN), because
    # every response that shows a provider also shows its category.
    category: Mapped[Category] = relationship(lazy="joined", innerjoin=True)


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("provider_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    author_name: Mapped[str] = mapped_column(Text)
    rating: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[str] = mapped_column(Text, server_default=text("''"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ContactEvent(Base):
    __tablename__ = "contact_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(Text)  # 'view', 'whatsapp' or 'call'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProviderSuggestion(Base):
    """Someone telling us about a provider who is not on Haddak yet.

    Anonymous on purpose: there is no user id and no IP address here.
    """

    __tablename__ = "provider_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )
    area_name: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Optional position: both set or both None (the database checks this too).
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)

    # The category is optional here, so this is a LEFT JOIN (no innerjoin=True):
    # suggestions without a category are still loaded.
    category: Mapped[Category | None] = relationship(lazy="joined")


class ProviderReport(Base):
    """Someone telling us that a listing is wrong, fake, closed or offensive.

    Anonymous on purpose, like suggestions: no user id and no IP address.
    """

    __tablename__ = "provider_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(Text)  # one of the values in schemas.ReportReason
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Loaded in the same query: the admin list shows the provider's name and status.
    provider: Mapped[Provider] = relationship(lazy="joined", innerjoin=True)


class Story(Base):
    """A short post by a verified provider, shown for 24 hours.

    Expired rows stay in the table; every query filters on expires_at.
    """

    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Banner(Base):
    """A provider's current offer. provider_id is the primary key, so a
    provider has at most one row; a new banner overwrites it."""

    __tablename__ = "banners"

    provider_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), primary_key=True
    )
    title: Mapped[str] = mapped_column(Text)
    text: Mapped[str | None] = mapped_column(Text)
    discount_percent: Mapped[int | None] = mapped_column(SmallInteger)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Follow(Base):
    """One row = this user follows this provider. The primary key is both columns
    together, so the same follow cannot exist twice."""

    __tablename__ = "follows"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HireCheck(Base):
    """Hire check ("Did you hire them?"): created when a signed-in user taps WhatsApp or
    Call. answer stays None until the user replies in the app.

    answer is 'hired', 'not_yet' or 'no_answer' (they did not pick up).
    """

    __tablename__ = "hire_checks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    contact_type: Mapped[str] = mapped_column(Text)  # 'whatsapp' or 'call'
    contacted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    answer: Mapped[str | None] = mapped_column(Text)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Place(Base):
    """A town or neighbourhood the assistant can centre a search on.

    The first rows were typed by hand (approximate centres); a GeoNames
    import replaces them later. See migration 0006.
    """

    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name_en: Mapped[str] = mapped_column(Text)
    name_ar: Mapped[str] = mapped_column(Text)
    # Other spellings people type: Arabizi, French, Arabic variants.
    aliases: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    kind: Mapped[str] = mapped_column(Text)  # 'city', 'town' or 'neighbourhood'
    district: Mapped[str] = mapped_column(Text)
    location = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False
    )
    radius_m: Mapped[int] = mapped_column(Integer)  # roughly how wide the place is

    lat: Mapped[float] = column_property(func.ST_Y(cast(location, Geometry)))
    lng: Mapped[float] = column_property(func.ST_X(cast(location, Geometry)))


class AssistCache(Base):
    """A remembered AI answer. Keyed by a hash of the normalised sentence, so
    the sentence itself is not stored here."""

    __tablename__ = "assist_cache"

    text_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    result: Mapped[dict] = mapped_column(JSONB)  # the checked AI answer
    model: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssistLog(Base):
    """One row per assistant request. No user id and no IP address.

    source: 'ai' (the AI was asked), 'cache' (remembered answer) or 'direct'
    (answered by our own code, no AI: the text was exactly a category or
    provider name, or the keyword fallback understood it).
    Only 'ai' rows have tokens and a cost.
    """

    __tablename__ = "assist_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    source: Mapped[str] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(Text)
    input_tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    output_tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    cache_read_tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    cache_write_tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6), server_default=text("0"))
    kind: Mapped[str] = mapped_column(Text)  # the response kind
    text_hash: Mapped[str] = mapped_column(Text)
    # The normalised sentence, stored only when the search found nothing:
    # the founder's "most wanted" list.
    wanted_text: Mapped[str | None] = mapped_column(Text)
    place_unknown: Mapped[str | None] = mapped_column(Text)  # a place name we could not find
