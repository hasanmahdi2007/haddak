# Haddak — database schema

Postgres with the PostGIS extension. This file is the source of truth; the Alembic migrations in `backend/` must produce exactly this. Change this file first, then add a migration.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,          -- e.g. 'laptop-repair'
    name_en     TEXT NOT NULL,
    name_ar     TEXT NOT NULL,
    icon        TEXT NOT NULL,                 -- icon key the app maps to a glyph
    parent_id   INTEGER REFERENCES categories(id),
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE providers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id         UUID NOT NULL UNIQUE,     -- Supabase auth user id; one profile per user
    slug                  TEXT NOT NULL UNIQUE,     -- short share code, e.g. 'k7m2xq'
    name                  TEXT NOT NULL,
    category_id           INTEGER NOT NULL REFERENCES categories(id),
    description           TEXT NOT NULL DEFAULT '',
    price_text            TEXT,                     -- free text, e.g. '$20 per lesson'
    phone                 TEXT NOT NULL,            -- E.164, e.g. '+96170123456'
    whatsapp              TEXT,                     -- E.164; null means same as phone
    location              GEOGRAPHY(Point, 4326) NOT NULL,
    area_name             TEXT NOT NULL,            -- e.g. 'Haret Hreik'
    photos                TEXT[] NOT NULL DEFAULT '{}',   -- public URLs, first is the cover
    verification_doc_url  TEXT,                     -- private; never returned to the public
    status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'verified', 'rejected')),
    founding_member       BOOLEAN NOT NULL DEFAULT FALSE,
    featured_until        DATE,
    avg_rating            NUMERIC(3,2) NOT NULL DEFAULT 0,
    review_count          INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    show_contact_count    BOOLEAN NOT NULL DEFAULT FALSE,   -- owner's choice: show "contacts this month" publicly
    opening_hours         JSONB                     -- null means hours not provided; shape below
);
CREATE INDEX providers_location_idx ON providers USING GIST (location);
CREATE INDEX providers_category_status_idx ON providers (category_id, status);

CREATE TABLE reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    author_name  TEXT NOT NULL,
    rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, user_id)
);

CREATE TABLE contact_events (
    id           BIGSERIAL PRIMARY KEY,
    provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    type         TEXT NOT NULL CHECK (type IN ('view', 'whatsapp', 'call')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contact_events_provider_time_idx ON contact_events (provider_id, created_at);

-- "I know a good provider who is not on Haddak": sent by anyone, read by the admin.
-- Deliberately no user id and no IP address.
CREATE TABLE provider_suggestions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    phone        TEXT,                               -- E.164, like providers.phone
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    area_name    TEXT,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migrations: `0001` created the first four tables; `0002` added `providers.show_contact_count`, `providers.opening_hours` and the `provider_suggestions` table.

### `providers.opening_hours`

A JSON object with optional keys `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. Each value is a list of at most 3 `[open, close]` pairs in 24-hour `"HH:MM"`, with open before close:

```json
{ "mon": [["09:00", "13:00"], ["15:00", "19:00"]], "sat": [["10:00", "14:00"]] }
```

A missing day (or an empty list) means closed that day. `NULL` for the whole column means the provider has not given hours. Times are Lebanon local time (`Asia/Beirut`). No overnight ranges in v1. The shape is validated by the API, not by the database.

## Rules the backend enforces

- The public only ever sees providers with `status = 'verified'`.
- `avg_rating` and `review_count` are recalculated in the same transaction whenever a review is created or changed.
- A provider cannot review their own profile.
- `verification_doc_url`, `owner_user_id` and `status` of other people's profiles are never returned publicly.
- Only the admin changes `status`, `founding_member` and `featured_until`.
- "Featured" means `featured_until >= today`.
- Contact events are always counted. The public sees a provider's monthly contact count (`whatsapp` + `call`, never views) only when that provider set `show_contact_count`.
- "Open now" is computed from `opening_hours` in the `Asia/Beirut` timezone; it is not stored.
- Suggestions are anonymous: no user id and no IP address is stored with them.

## Search query

Inputs: `lat`, `lng`, `radius_m`, optional `category_id` (matches the category or any of its children).

1. Filter: `status = 'verified'` and `ST_DWithin(location, point, radius_m)`.
2. Compute `distance_m = ST_Distance(location, point)`.
3. Order by:
   1. featured first;
   2. weighted rating, descending: `(review_count * avg_rating + 5 * 3.5) / (review_count + 5)`. This stops one 5-star review from outranking fifty 4.8-star reviews;
   3. `distance_m`, ascending.

## Seed data (development only)

About 12 top-level categories with a few children each, and about 30 fake verified providers around Haret Hreik (33.8547, 35.5097) and wider Beirut, at known distances so the radius tests are exact.
