# Haddak — database schema

Postgres with the PostGIS extension. This file is the source of truth; the Alembic migrations in `backend/` must produce exactly this. Change this file first, then add a migration.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- similarity() for fuzzy place lookup

-- Lower case, plain Arabic letters (no hamza forms, ة -> ه, ى -> ي), no Latin
-- accents. Used on both sides of every place comparison; the Python twin is
-- app/services/assist/normalize.py.
CREATE FUNCTION normalize_name(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT lower(translate(value,
        'أإآٱؤئةىéèêëàâäáôöóûüùúîïíçÉÈÊÀÂÔÛÎÇـ',
        'ااااويهيeeeeaaaaooouuuuiiiceeeaaouic'))
$$;

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
                          CHECK (source IN ('owner', 'suggestion')),
    sponsor_hook          TEXT CHECK (char_length(sponsor_hook) <= 80),  -- one-sentence pitch, shown only while sponsored
    price_amount          NUMERIC(12,2) CHECK (price_amount > 0),        -- structured price, e.g. 15.00
    price_unit            TEXT CHECK (price_unit IN ('hour', 'visit', 'job', 'item', 'month')),
    price_currency        TEXT NOT NULL DEFAULT 'USD' CHECK (price_currency IN ('USD', 'LBP')),
    CONSTRAINT providers_price_amount_unit_together
        CHECK ((price_amount IS NULL) = (price_unit IS NULL))
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

-- A short post by a verified provider. Shown for 24 hours, then simply
-- filtered out by time (rows are not deleted by any background job).
CREATE TABLE stories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    text         TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 280),
    image_url    TEXT,                               -- https only (checked by the API)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL                -- created_at + 24 hours
);
CREATE INDEX stories_provider_expires_idx ON stories (provider_id, expires_at);

-- A provider's current offer ("weekly banner", "discount"). At most one row
-- per provider: the provider id is the primary key, a new banner replaces the old.
CREATE TABLE banners (
    provider_id       UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
    title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
    text              TEXT CHECK (char_length(text) <= 200),
    discount_percent  SMALLINT CHECK (discount_percent BETWEEN 1 AND 90),
    starts_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL           -- starts_at + 1 to 7 days
);

-- "This user follows this provider". user_id is the Supabase auth user id.
CREATE TABLE follows (
    user_id      UUID NOT NULL,
    provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, provider_id)
);
CREATE INDEX follows_provider_idx ON follows (provider_id);   -- for follower counts

-- Towns and neighbourhoods the assistant can centre a search on. Reference
-- data, inserted by migration 0006 (about 80 rows, APPROXIMATE hand-placed
-- centres), to be replaced by a GeoNames import.
CREATE TABLE places (
    id          SERIAL PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,               -- e.g. 'jdeideh-metn'
    name_en     TEXT NOT NULL,                      -- may repeat: two towns called 'Jdeideh'
    name_ar     TEXT NOT NULL,
    aliases     TEXT[] NOT NULL DEFAULT '{}',       -- other spellings: Arabizi, French, Arabic variants
    kind        TEXT NOT NULL CHECK (kind IN ('city', 'town', 'neighbourhood')),
    district    TEXT NOT NULL,                      -- tells same-named places apart
    location    GEOGRAPHY(Point, 4326) NOT NULL,    -- centre
    radius_m    INTEGER NOT NULL CHECK (radius_m BETWEEN 100 AND 50000)   -- rough size
);
CREATE INDEX places_name_en_trgm_idx ON places USING GIN (normalize_name(name_en) gin_trgm_ops);

-- Remembered AI answers: same normalised sentence -> same settings, no second
-- AI request. Only a hash of the sentence is stored.
CREATE TABLE assist_cache (
    text_hash   TEXT PRIMARY KEY,                   -- SHA-256 of the normalised sentence
    result      JSONB NOT NULL,                     -- the checked AI answer
    model       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()  -- older than 30 days is asked again
);

-- One row per assistant request. No user id and no IP address.
CREATE TABLE assist_log (
    id                  BIGSERIAL PRIMARY KEY,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    source              TEXT NOT NULL CHECK (source IN ('ai', 'cache', 'direct')),
    model               TEXT,                       -- set when source = 'ai'
    input_tokens        INTEGER NOT NULL DEFAULT 0,
    output_tokens       INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens   INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens  INTEGER NOT NULL DEFAULT 0,
    cost_usd            NUMERIC(10,6) NOT NULL DEFAULT 0,
    kind                TEXT NOT NULL,              -- the response kind (results, clarify, ...)
    text_hash           TEXT NOT NULL,
    wanted_text         TEXT,                       -- the normalised sentence, only when the search found nothing
    place_unknown       TEXT                        -- a place name the lookup could not find
);
CREATE INDEX assist_log_created_idx ON assist_log (created_at);
```

Migrations: `0001` created the first four tables; `0002` added `providers.show_contact_count`, `providers.opening_hours` and the `provider_suggestions` table; `0003` added the `unverified` status, made `providers.owner_user_id` nullable, and added `providers.source`, `provider_suggestions.lat` / `lng` and the `provider_reports` table; `0004` added `providers.sponsor_hook` and the `stories`, `banners` and `follows` tables; `0005` added `providers.price_amount`, `price_unit` and `price_currency`; `0006` added `pg_trgm`, `normalize_name()`, the `places` table with its first rows, and the `assist_cache` and `assist_log` tables.

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
- "Featured" means `featured_until >= today`. Users see it as "Sponsored": `sponsored` is true for a verified provider that is featured. There are no payments in the app yet; the admin sets the date by hand.
- `sponsor_hook` is written by the owner, but the public only receives it while the provider is sponsored.
- Stories and banners: only the owner of a `verified` provider may post. A story is active while `expires_at > now` (24 hours); at most 5 active stories per provider. A banner is active while `starts_at <= now < expires_at`; one per provider. Expired rows are filtered out by time, never deleted by a job. Posts of a provider that is no longer `verified` are hidden everywhere public.
- Follows: any signed-in user may follow any public (not `rejected`) provider. Rejected providers are left out of the following list and the feed.
- Contact events are always counted. The public sees a provider's monthly contact count (`whatsapp` + `call`, never views) only when that provider set `show_contact_count`.
- "Open now" is computed from `opening_hours` in the `Asia/Beirut` timezone; it is not stored.
- Suggestions and reports are anonymous: no user id and no IP address is stored with them.
- Structured prices: `price_amount` and `price_unit` are both set or both NULL. `price_text` is only a description; search uses the structured fields.
- Assistant: `assist_log` and `assist_cache` hold no user id, no IP and no location. The sentence is stored (normalised) only in `assist_log.wanted_text`, and only when its search found nothing. The monthly budget is the sum of `assist_log.cost_usd` in the current UTC month.
- Place lookup: exact match on `normalize_name()` of `name_en`, `name_ar` or an alias first; otherwise the best `similarity()` of 0.35 or more. Several rows are returned only when they share the English name (same name, different districts).
- Publishing a suggestion creates the provider and deletes the suggestion in one transaction.

## Search query

Inputs: `lat`, `lng`, `radius_m`, optional `category_id` (matches the category or any of its children; the assistant may pass several), optional `include_unverified` (default false), optional `max_price` with `price_unit` and `price_currency`, optional `open_now`, `sort` (`best`, `distance` or `price`).

1. Filter: `ST_DWithin(location, point, radius_m)` and `status = 'verified'`. With `include_unverified`, the status filter is `status IN ('verified', 'unverified', 'pending')` instead. `rejected` never matches.
   With `max_price`: `price_amount <= max_price AND price_unit = :unit AND price_currency = :currency` (no structured price = left out). With `open_now`: today's ranges in `opening_hours` (Beirut day and "HH:MM" time) contain the current minute; no hours = left out.
2. Compute `distance_m = ST_Distance(location, point)`.
3. Order by:
   1. verified first: every verified provider comes before every non-verified one;
   2. featured first. Only counts for verified providers: a `featured_until` date on a non-verified one is ignored;
   3. weighted rating, descending: `(review_count * avg_rating + 5 * 3.5) / (review_count + 5)`. This stops one 5-star review from outranking fifty 4.8-star reviews;
   4. `distance_m`, ascending;
   5. `id`, so paging is stable.

   `sort=distance`: verified first, then `distance_m`, then `id`. `sort=price`: `price_amount` ascending (NULL last), then the order above.

## Seed data (development only)

About 12 top-level categories with a few children each, and 32 fake verified providers around Haret Hreik (33.8547, 35.5097) and wider Beirut, at known distances so the radius tests are exact. 31 providers have a structured price (tutors per hour, repairs per job, doctors per visit, products per item; tutors both under and over $20/hour; one carpenter in LBP). Plus 8 non-verified ones within about 1 km of the centre, so the "include unverified" switch visibly changes results: 6 `unverified` (3 of them `source = 'suggestion'` with no owner) and 2 `pending`. 4 verified providers are sponsored (future `featured_until` and a `sponsor_hook`); a handful of verified providers have active stories and 3 have an active banner.
