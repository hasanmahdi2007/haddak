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
    owner_user_id         UUID UNIQUE,              -- Supabase auth user id; one profile per user.
                                                    -- NULL = a listing nobody has claimed yet
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
    status                TEXT NOT NULL DEFAULT 'unverified'
                          CHECK (status IN ('unverified', 'pending', 'verified', 'rejected')),
    founding_member       BOOLEAN NOT NULL DEFAULT FALSE,
    featured_until        DATE,
    avg_rating            NUMERIC(3,2) NOT NULL DEFAULT 0,
    review_count          INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    show_contact_count    BOOLEAN NOT NULL DEFAULT FALSE,   -- owner's choice: show "contacts this month" publicly
    opening_hours         JSONB,                    -- null means hours not provided; shape below
    source                TEXT NOT NULL DEFAULT 'owner'     -- who created the listing
                          CHECK (source IN ('owner', 'suggestion'))
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
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    lat          DOUBLE PRECISION CHECK (lat BETWEEN -90 AND 90),     -- optional position:
    lng          DOUBLE PRECISION CHECK (lng BETWEEN -180 AND 180),   -- both or neither
    CONSTRAINT provider_suggestions_lat_lng_together CHECK ((lat IS NULL) = (lng IS NULL))
);

-- "Something is wrong with this listing": sent by anyone, read by the admin.
-- Deliberately no user id and no IP address.
CREATE TABLE provider_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL
                 CHECK (reason IN ('wrong_info', 'not_real', 'closed', 'offensive', 'other')),
    note         TEXT CHECK (char_length(note) <= 500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX provider_reports_provider_idx ON provider_reports (provider_id);
```

Migrations: `0001` created the first four tables; `0002` added `providers.show_contact_count`, `providers.opening_hours` and the `provider_suggestions` table; `0003` added the `unverified` status, made `providers.owner_user_id` nullable, and added `providers.source`, `provider_suggestions.lat` / `lng` and the `provider_reports` table.

### `providers.status`

| Status | Public? | Meaning |
|---|---|---|
| `unverified` | listed, no badge | No proof submitted, or the proof was not accepted. |
| `pending` | listed, no badge | Proof submitted, waiting for the founder. Looks exactly like `unverified` to the public. |
| `verified` | listed, with the badge | A human (the founder) checked the proof. |
| `rejected` | hidden (404) | Fake, abusive or duplicate. |

Who moves a profile between statuses:

- Owner, on create: `pending` if a `verification_doc_url` is sent, otherwise `unverified`.
- Owner, on update: an `unverified` profile becomes `pending` when a new `verification_doc_url` is sent; a `pending` profile whose proof is removed goes back to `unverified`. No other owner edit changes the status.
- Admin: verify (any -> `verified`), reject (any -> `rejected`), decline proof (`pending` -> `unverified`), restore (`rejected` -> `unverified`).

### `providers.source` and unclaimed listings

`source = 'owner'`: the provider created the profile in the app. `source = 'suggestion'`: the admin published it from a row in `provider_suggestions`; it starts `unverified` with `owner_user_id = NULL` ("listed by the community"). `UNIQUE (owner_user_id)` still means one profile per user: Postgres lets any number of rows have NULL there.

### `providers.opening_hours`

A JSON object with optional keys `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. Each value is a list of at most 3 `[open, close]` pairs in 24-hour `"HH:MM"`, with open before close:

```json
{ "mon": [["09:00", "13:00"], ["15:00", "19:00"]], "sat": [["10:00", "14:00"]] }
```

A missing day (or an empty list) means closed that day. `NULL` for the whole column means the provider has not given hours. Times are Lebanon local time (`Asia/Beirut`). No overnight ranges in v1. The shape is validated by the API, not by the database.

## Rules the backend enforces

- The public sees providers with status `verified`, `unverified` or `pending`; `rejected` ones answer 404. Only `verified` ones carry the badge, and search returns only those unless the searcher asks for unverified ones too.
- Verification is always a human decision made in the admin page.
- `avg_rating` and `review_count` are recalculated in the same transaction whenever a review is created or changed.
- A provider cannot review their own profile.
- `verification_doc_url`, `owner_user_id` and `status` of other people's profiles are never returned publicly.
- Only the admin changes `status`, `founding_member` and `featured_until`.
- "Featured" means `featured_until >= today`.
- Contact events are always counted. The public sees a provider's monthly contact count (`whatsapp` + `call`, never views) only when that provider set `show_contact_count`.
- "Open now" is computed from `opening_hours` in the `Asia/Beirut` timezone; it is not stored.
- Suggestions and reports are anonymous: no user id and no IP address is stored with them.
- Publishing a suggestion creates the provider and deletes the suggestion in one transaction.

## Search query

Inputs: `lat`, `lng`, `radius_m`, optional `category_id` (matches the category or any of its children), optional `include_unverified` (default false).

1. Filter: `ST_DWithin(location, point, radius_m)` and `status = 'verified'`. With `include_unverified`, the status filter is `status IN ('verified', 'unverified', 'pending')` instead. `rejected` never matches.
2. Compute `distance_m = ST_Distance(location, point)`.
3. Order by:
   1. verified first: every verified provider comes before every non-verified one;
   2. featured first. Only counts for verified providers: a `featured_until` date on a non-verified one is ignored;
   3. weighted rating, descending: `(review_count * avg_rating + 5 * 3.5) / (review_count + 5)`. This stops one 5-star review from outranking fifty 4.8-star reviews;
   4. `distance_m`, ascending;
   5. `id`, so paging is stable.

## Seed data (development only)

About 12 top-level categories with a few children each, and 30 fake verified providers around Haret Hreik (33.8547, 35.5097) and wider Beirut, at known distances so the radius tests are exact. Plus 6 non-verified ones within 1 km of the centre, so the "include unverified" switch visibly changes results: 4 `unverified` (2 of them `source = 'suggestion'` with no owner) and 2 `pending`.
