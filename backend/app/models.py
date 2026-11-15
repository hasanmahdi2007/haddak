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
