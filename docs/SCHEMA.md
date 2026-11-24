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
    sort_order  INTEGER NOT NULL DEFAULT 0,
    aliases     TEXT[] NOT NULL DEFAULT '{}'   -- 0016: extra search words: Lebanese Arabic,
                                               -- Arabizi, English synonyms ('sankari', 'سمكري', 'plumbing')
);
-- 0016: GIN trigram indexes on normalize_name(name_en), normalize_name(name_ar)
-- for fuzzy category matching in text search.

CREATE TABLE providers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id         UUID UNIQUE,              -- Supabase auth user id; one profile per user.
                                                    -- NULL = a listing nobody has claimed yet
    slug                  TEXT NOT NULL UNIQUE,     -- short share code, e.g. 'k7m2xq'
    name                  TEXT NOT NULL,
    category_id           INTEGER NOT NULL REFERENCES categories(id),
    description           TEXT NOT NULL DEFAULT '',
    price_text            TEXT,                     -- free text, e.g. '$20 per lesson'
    phone                 TEXT,                     -- E.164, e.g. '+96170123456'; NULL only for 'osm'
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
                          CHECK (source IN ('owner', 'suggestion', 'osm')),
    osm_ref               TEXT UNIQUE,              -- 'node/123' or 'way/456' for OpenStreetMap imports, else NULL
    sponsor_hook          TEXT CHECK (char_length(sponsor_hook) <= 80),  -- one-sentence pitch, shown only while sponsored
    price_amount          NUMERIC(12,2) CHECK (price_amount > 0),        -- structured price, e.g. 15.00
    price_unit            TEXT CHECK (price_unit IN ('hour', 'visit', 'job', 'item', 'month')),
    price_currency        TEXT NOT NULL DEFAULT 'USD' CHECK (price_currency IN ('USD', 'LBP')),
    available_until       TIMESTAMPTZ,                                   -- "Available now" until this moment; NULL = off
    CONSTRAINT providers_price_amount_unit_together
        CHECK ((price_amount IS NULL) = (price_unit IS NULL)),
    CONSTRAINT providers_phone_required
        CHECK (phone IS NOT NULL OR source = 'osm')    -- OSM places often have no number
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
                 CHECK (reason IN ('wrong_info', 'not_real', 'closed', 'offensive',
                                   'remove_my_business', 'other')),
    note         TEXT CHECK (char_length(note) <= 500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX provider_reports_provider_idx ON provider_reports (provider_id);

-- "Is this your business? Claim it": a signed-in user asks to own a listing
-- that has no owner (owner_user_id IS NULL). The founder approves or rejects.
CREATE TABLE claims (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id           UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL,             -- Supabase auth user id of the claimer
    message               TEXT CHECK (char_length(message) <= 500),
    verification_doc_url  TEXT,                      -- optional proof; private like providers'
    status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at            TIMESTAMPTZ               -- set when approved or rejected
);
-- One open claim per user and listing.
CREATE UNIQUE INDEX claims_one_pending_idx ON claims (provider_id, user_id) WHERE status = 'pending';
CREATE INDEX claims_status_created_idx ON claims (status, created_at);

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

-- "Did you hire them?": one row when a signed-in user taps WhatsApp or Call.
-- The app asks the user later (12 hours to 14 days after the tap); answer stays
-- NULL until they reply. At most one row per user and provider in 7 days.
CREATE TABLE hire_checks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id   UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,                     -- Supabase auth user id
    contact_type  TEXT NOT NULL CHECK (contact_type IN ('whatsapp', 'call')),
    contacted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    answer        TEXT CHECK (answer IN ('hired', 'not_yet', 'no_answer')),
    answered_at   TIMESTAMPTZ,
    CONSTRAINT hire_checks_answer_time_together CHECK ((answer IS NULL) = (answered_at IS NULL))
);
CREATE INDEX hire_checks_user_contacted_idx ON hire_checks (user_id, contacted_at);
CREATE INDEX hire_checks_provider_answer_idx ON hire_checks (provider_id, answer, answered_at);

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

Migrations: `0001` created the first four tables; `0002` added `providers.show_contact_count`, `providers.opening_hours` and the `provider_suggestions` table; `0003` added the `unverified` status, made `providers.owner_user_id` nullable, and added `providers.source`, `provider_suggestions.lat` / `lng` and the `provider_reports` table; `0004` added `providers.sponsor_hook` and the `stories`, `banners` and `follows` tables; `0005` added `providers.price_amount`, `price_unit` and `price_currency`; `0006` added `pg_trgm`, `normalize_name()`, the `places` table with its first rows, and the `assist_cache` and `assist_log` tables; `0007` added the `hire_checks` table; `0008` added `providers.available_until`; `0009` added categories (power, appliance repair, pharmacy); `0010` added `source = 'osm'`, `providers.osm_ref`, made `providers.phone` nullable for `osm` rows only, added the `remove_my_business` report reason and the `claims` table; `0016` adds `categories.aliases` and trigram indexes on the category names; `0017` adds 85 categories (tree v2, below) and aliases for all of them.; `0016` adds `categories.aliases` and trigram indexes on the category names; `0017` adds 85 categories (tree v2, below) and aliases for all of them.

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

`source = 'owner'`: the provider created the profile in the app. `source = 'suggestion'`: the admin published it from a row in `provider_suggestions`; it starts `unverified` with `owner_user_id = NULL` ("listed by the community"). `source = 'osm'`: imported from OpenStreetMap by `backend/scripts/import_osm.py` (below); also `unverified` with no owner.

Claiming: a signed-in user sends a claim (`claims` row, `pending`). When the founder approves, `owner_user_id` is set to the claimer, the other pending claims for that listing are rejected, and, if the claim carried proof, the proof is copied to `verification_doc_url` and an `unverified` listing becomes `pending` (the owner's proof rule). `source` does not change on a claim, so an OpenStreetMap listing keeps its attribution.

### OpenStreetMap import (`source = 'osm'`)

`backend/scripts/import_osm.py` asks the public Overpass API once for a bounding box (default Greater Beirut) and maps OSM tags to existing category slugs; tags that map to nothing are skipped and no category is ever created. Only named places are kept. It stores the name, the point (a way's centre), phone and WhatsApp from `phone` / `contact:phone` / `contact:whatsapp` (normalised to `+961…`; NULL when missing or unreadable), simple `opening_hours` (anything complex is left NULL) and the area from `addr:*` tags (else the nearest row in `places`). Rows are `unverified`, `owner_user_id = NULL`, `photos = '{}'`, keyed by `osm_ref` so a re-run updates instead of duplicating. A re-run never touches a claimed listing, nor a listing's status (a rejected one stays rejected).

Licence: OpenStreetMap data is under the ODbL. Haddak shows it with attribution ("Data © OpenStreetMap contributors", via `data_source` in the API). If the database itself (or an extract of it) is ever shared, the OSM-derived part must stay under the ODbL. Owners who did not ask to be listed can claim the listing or report it with "This is my business and I want it removed" (`remove_my_business`); the founder then rejects it. `UNIQUE (owner_user_id)` still means one profile per user: Postgres lets any number of rows have NULL there.

### `providers.available_until`

The owner's "Available now" switch, for providers without fixed hours. Switching it on sets `now() + 2, 4 or 8 hours`; switching it off sets `NULL`. The provider counts as available while `available_until > now()`; nothing clears the column when the time passes, it is simply compared on every read. No index: it is only ever tested on rows already chosen by the location filter.

### `providers.opening_hours`

A JSON object with optional keys `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. Each value is a list of at most 3 `[open, close]` pairs in 24-hour `"HH:MM"`, with open before close:

```json
{ "mon": [["09:00", "13:00"], ["15:00", "19:00"]], "sat": [["10:00", "14:00"]] }
```

A missing day (or an empty list) means closed that day. `NULL` for the whole column means the provider has not given hours. Times are Lebanon local time (`Asia/Beirut`). No overnight ranges in v1. The shape is validated by the API, not by the database.

## Rules the backend enforces

- The public sees providers with status `verified`, `unverified` or `pending`; `rejected` ones answer 404. Only `verified` ones carry the badge, and search returns only those unless the searcher asks for unverified ones too (the app asks by default since 2026-11-17, and the assistant always does; verified ones still come first).
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
- Claims are only for listings with `owner_user_id IS NULL`; at most one `pending` claim per user and listing; a user who already owns a profile cannot claim another.
- Structured prices: `price_amount` and `price_unit` are both set or both NULL. `price_text` is only a description; search uses the structured fields.
- Assistant: `assist_log` and `assist_cache` hold no user id, no IP and no location. The sentence is stored (normalised) only in `assist_log.wanted_text`, and only when its search found nothing. The monthly budget is the sum of `assist_log.cost_usd` in the current UTC month; the daily budget is the same sum since midnight in Lebanon.
- `assist_quota` (`subject`, `day`, `used`; primary key `subject, day`): AI requests per person or IP per day (Lebanon time). `subject` is a keyed hash of the day and who (see `AI_ASSISTANT.md`), never an IP, account id or install id. Rows older than two days are deleted.
- Every table in `public` has Row Level Security on, with no policies (migration 0012), and the Supabase roles `anon` and `authenticated` have no privileges on them. The backend connects as the tables' owner, which Row Level Security does not limit. **A migration that creates a table must also run `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`**; `tests/test_db_security.py` fails otherwise.
- Every function in `public` has a fixed search path (migration 0013): **a migration that creates a function must give it `SET search_path = ''`** and call only built-in or schema-qualified functions; `tests/test_db_security.py` fails otherwise.
- The category tree is reference data that comes from the migrations (0009, 0014, 0017), so the hosted database, which is never seeded, has it too. **Changing a category needs a new migration and the same change in `scripts/seed.py`'s `CATEGORIES`**; `tests/test_categories_migration.py` fails when the two disagree.
- Migration 0015 adds `reviews (user_id)`, `claims (user_id)` (for `DELETE /me`), `categories (parent_id)` and `provider_suggestions (category_id)` (foreign keys the Performance Advisor listed).
- On Supabase only, schema `haddak_private` holds `delete_auth_user(uuid)` (`supabase/delete_auth_user.sql`, applied by hand as `postgres`): a `security definer` function that deletes one `auth.users` row, executable only by `haddak_api`. It is not in a migration because `haddak_api` may not touch `auth`; the backend checks it exists and skips it locally.
- On Supabase the tables are owned by the role `haddak_api` that the backend logs in as (see `DEPLOY.md`); locally they are owned by `haddak`.
- Place lookup: exact match on `normalize_name()` of `name_en`, `name_ar` or an alias first; otherwise the best `similarity()` of 0.35 or more. Several rows are returned only when they share the English name (same name, different districts).
- Publishing a suggestion creates the provider and deletes the suggestion in one transaction.
- Hire checks ("Did you hire them?"): a `whatsapp` or `call` contact event sent with a valid login token creates a `hire_checks` row, unless the same user already has one for that provider with `contacted_at` in the last 7 days (answered or not), or the user owns the provider. Only that user may answer, and only once. A review is "hired through Haddak" when its author has a `hired` answer for that provider (computed when read, so a review written later also counts). `confirmed_hires` = `hired` answers with `answered_at` in the last 90 days. `no_answer` answers are shown to the admin only. Search ranking does not use hire checks yet.

## Category tree v2 (migration 0017, 2026-11-24)

The founder widened the scope to every paid service and shop (see `PROJECT.md`). 0017 **adds** 85 categories to the 58 from 0014, for 143 in total. Existing slugs are never renamed or moved, so their ids stay the same. `scripts/seed.py`'s `CATEGORIES` holds the same tree, and 0017's frozen copy is what `tests/test_categories_migration.py` compares against. Every category (old and new) also gets `aliases`. The OSM column says which OpenStreetMap tags `services/osm_import.py` maps to that slug ("—" = no reliable OSM tag; filled by owners, suggestions and claims).

New children under existing groups:

| Parent | slug | English | Arabic | icon | OSM tags |
|---|---|---|---|---|---|
| doctors | optician | Optician | نظارات | glasses | shop=optician |
| doctors | medical-lab | Medical lab | مختبر | flask | healthcare=laboratory |
| doctors | physiotherapist | Physiotherapist | علاج فيزيائي | activity | healthcare=physiotherapist |
| doctors | hospital | Hospital | مستشفى | hospital | amenity=hospital, healthcare=hospital |
| home-repair | locksmith | Locksmith | مفاتيحي | key | shop=locksmith, craft=locksmith, craft=key_cutter |
| home-repair | cleaning | Cleaning | تنظيف | sparkles | craft=cleaning |
| home-repair | movers | Movers | نقل عفش | truck | office=moving_company |
| home-repair | pest-control | Pest control | رش مبيدات | bug | craft=pest_control |
| home-repair | water-tank-cleaning | Water tank cleaning | تنظيف خزانات | container | — |
| home-repair | glass-aluminium | Glass & aluminium | زجاج وألمنيوم | window | craft=glaziery, shop=glaziery, craft=window_construction |
| home-repair | tiler | Tiler | مبلّط | grid | craft=tiler |
| home-repair | welder | Blacksmith & welder | حدّاد | anvil | craft=metal_construction, craft=blacksmith, craft=welder |
| home-repair | upholsterer | Upholsterer | منجّد | armchair | craft=upholsterer |
| car-services | tyres | Tyres | دواليب | tyre | shop=tyres |
| car-services | car-parts | Car parts | قطع سيارات | cog | shop=car_parts |
| car-services | driving-school | Driving school | مدرسة سواقة | steering | amenity=driving_school |
| car-services | fuel-station | Fuel station | محطة بنزين | fuel | amenity=fuel |
| car-services | car-rental | Car rental | تأجير سيارات | car-key | amenity=car_rental |
| car-services | towing | Towing | سحب سيارات | tow-truck | — |
| tutoring | nursery | Nursery | حضانة | baby | amenity=kindergarten, amenity=childcare |
| tutoring | language-school | Language school | مدرسة لغات | languages | amenity=language_school |
| fitness | sports-shop | Sports shop | أدوات رياضة | trophy | shop=sports |
| beauty | spa-massage | Spa & massage | سبا ومساج | flower | shop=massage |

New groups (parent row first, then its children):

| Parent | slug | English | Arabic | icon | OSM tags |
|---|---|---|---|---|---|
| — | food-drink | Food & drink | أكل وشرب | utensils | |
| food-drink | restaurant | Restaurant | مطعم | utensils | amenity=restaurant |
| food-drink | shawarma-manakish | Shawarma & manakish | شاورما ومناقيش | sandwich | amenity=fast_food with `cuisine` containing shawarma, lebanese, falafel, manakish, manaeesh or arab (checked before fast-food) |
| food-drink | fast-food | Fast food | وجبات سريعة | burger | amenity=fast_food (any other) |
| food-drink | cafe | Café | كافيه | coffee | amenity=cafe |
| food-drink | bakery | Bakery | فرن | croissant | shop=bakery |
| food-drink | juice-ice-cream | Juice & ice cream | عصير وبوظة | ice-cream | amenity=ice_cream, shop=ice_cream |
| food-drink | catering | Catering | تموين حفلات | chef-hat | craft=caterer |
| — | groceries | Groceries | سمانة وخضرة | cart | |
| groceries | supermarket | Supermarket | سوبرماركت | cart | shop=supermarket |
| groceries | mini-market | Mini-market | دكّانة | store | shop=convenience, shop=general |
| groceries | greengrocer | Greengrocer | خضرجي | apple | shop=greengrocer |
| groceries | butcher | Butcher | لحّام | beef | shop=butcher |
| groceries | roastery | Roastery & nuts | محمصة | nut | shop=nuts, shop=coffee |
| groceries | water-delivery | Drinking water | مي للشرب | droplets | shop=water |
| — | fashion | Fashion | أزياء | shirt | |
| fashion | kids-clothes | Kids' clothes | ألبسة ولاد | baby | shop=baby_goods, shop=clothes with `clothes` containing children or babies (checked before clothes) |
| fashion | clothes | Clothes | ألبسة | shirt | shop=clothes, shop=boutique |
| fashion | shoes | Shoes | أحذية | shoe | shop=shoes |
| fashion | bags-accessories | Bags & accessories | شنط واكسسوارات | bag | shop=bag, shop=fashion_accessories |
| fashion | jewellery | Jewellery | مجوهرات | gem | shop=jewelry |
| fashion | perfume-cosmetics | Perfume & cosmetics | عطور وتجميل | spray | shop=perfumery, shop=cosmetics |
| — | home-shops | Home shops | أدوات ومفروشات | sofa | |
| home-shops | hardware | Hardware | خردوات وعدّة | hammer | shop=hardware, shop=doityourself |
| home-shops | furniture | Furniture | مفروشات | sofa | shop=furniture |
| home-shops | appliance-store | Appliances store | أدوات كهربائية منزلية | fridge | shop=appliance |
| home-shops | electrical-supplies | Electrical supplies | لوازم كهرباء | plug | shop=electrical |
| home-shops | paint-shop | Paint shop | دهانات | paint-bucket | shop=paint |
| home-shops | lighting | Lighting | إنارة | lamp | shop=lighting |
| home-shops | curtains | Curtains | برادي | blinds | shop=curtain |
| home-shops | gas-cylinders | Gas cylinders | قناني غاز | flame | shop=gas |
| — | pets | Pets | حيوانات أليفة | paw | |
| pets | vet | Vet | طبيب بيطري | stethoscope | amenity=veterinary |
| pets | pet-shop | Pet shop | محل حيوانات | paw | shop=pet |
| pets | pet-grooming | Pet grooming | تزيين حيوانات | scissors | shop=pet_grooming |
| — | everyday-services | Everyday services | خدمات يومية | briefcase | |
| everyday-services | laundry | Laundry & dry cleaning | مصبغة | washing-machine | shop=laundry, shop=dry_cleaning |
| everyday-services | printing | Printing & copies | طباعة وتصوير | printer | shop=copyshop, craft=printer |
| everyday-services | money-transfer | Money transfer | تحويل أموال | banknote | amenity=money_transfer, amenity=bureau_de_change |
| everyday-services | real-estate | Real estate | مكتب عقارات | building | office=estate_agent |
| everyday-services | travel-agency | Travel agency | مكتب سفريات | plane | shop=travel_agency, office=travel_agent |
| everyday-services | lawyer | Lawyer | محامي | scale | office=lawyer |
| everyday-services | accountant | Accountant | محاسب | calculator | office=accountant, office=tax_advisor |
| everyday-services | insurance | Insurance | تأمين | shield | office=insurance |
| — | phones-electronics | Phones & electronics | تلفونات وإلكترونيات | smartphone | |
| phones-electronics | phone-shop | Phone shop | محل تلفونات | smartphone | shop=mobile_phone (was phone-repair) |
| phones-electronics | computer-shop | Computer shop | محل كمبيوتر | monitor | shop=computer (was laptop-repair) |
| phones-electronics | electronics-shop | Electronics shop | محل إلكترونيات | cpu | shop=electronics (was tech-repair; craft=electronics_repair stays tech-repair) |
| — | events | Events | مناسبات | party | |
| events | florist | Florist | زهور | flower | shop=florist |
| events | wedding-planner | Wedding & event planner | منظّم أعراس وحفلات | heart | — |
| events | party-supplies | Party supplies | لوازم حفلات | party-popper | shop=party |
| events | event-venue | Event venue | صالة مناسبات | venue | amenity=events_venue |
| — | books-gifts | Books & gifts | كتب وهدايا | gift | |
| books-gifts | bookshop | Bookshop | مكتبة | book | shop=books |
| books-gifts | stationery | Stationery | قرطاسية | pencil | shop=stationery |
| books-gifts | gift-shop | Gift shop | هدايا | gift | shop=gift |
| books-gifts | toy-shop | Toy shop | ألعاب ولاد | blocks | shop=toys |
| — | volunteering | Volunteering & NGOs | تطوّع وجمعيات | hand-heart | |
| volunteering | ngo | NGO | جمعية | hand-heart | office=ngo, office=association, office=charity |
| volunteering | community-centre | Community centre | مركز اجتماعي | users | amenity=community_centre, amenity=social_centre |
| volunteering | food-bank | Food bank | بنك طعام | soup | amenity=food_bank, amenity=social_facility with social_facility=food_bank |

New groups get `sort_order` 14 to 23 in the order above; children are numbered in their table order. Remapping `shop=mobile_phone`, `shop=computer` and `shop=electronics` only moves **unclaimed** OSM rows on the next import (claimed rows are never touched).

## Search query

Inputs: `lat`, `lng`, `radius_m`, optional `category_id` (matches the category or any of its children; the assistant may pass several), optional `include_unverified` (default false), optional `max_price` with `price_unit` and `price_currency`, optional `open_now`, optional `available_now`, `sort` (`best`, `distance` or `price`).

1. Filter: `ST_DWithin(location, point, radius_m)` and `status = 'verified'`. With `include_unverified`, the status filter is `status IN ('verified', 'unverified', 'pending')` instead. `rejected` never matches.
   With `max_price`: `price_amount <= max_price AND price_unit = :unit AND price_currency = :currency` (no structured price = left out). With `open_now`: today's ranges in `opening_hours` (Beirut day and "HH:MM" time) contain the current minute, OR `available_until > now` (marked "Available now"); no hours and not available = left out. With `available_now`: `available_until > now`.
2. Compute `distance_m = ST_Distance(location, point)`.
   With `q` (text search, 2026-11-24): keep a provider when `normalize_name(name)` contains `normalize_name(q)`, OR its category or that category's parent matches (normalized `name_en`, `name_ar` or an element of `aliases` contains the normalized `q`, or `similarity()` of `q` with the normalized `name_en`/`name_ar` is 0.4 or more), OR `normalize_name(area_name)` contains it.
3. Order by:
   0. with `q` only: providers whose name matches come first;
   1. verified first: every verified provider comes before every non-verified one;
   1b. among non-verified providers, those with a `phone` or `whatsapp` come before those with neither (OSM listings often have no number);
   2. featured first. Only counts for verified providers: a `featured_until` date on a non-verified one is ignored;
   3. weighted rating, descending: `(review_count * avg_rating + 5 * 3.5) / (review_count + 5)`. This stops one 5-star review from outranking fifty 4.8-star reviews;
   4. `distance_m`, ascending;
   5. `id`, so paging is stable.

   `sort=distance`: verified first, then `distance_m`, then `id`. `sort=price`: `price_amount` ascending (NULL last), then the order above.

## Seed data (development only)

About 12 top-level categories with a few children each, and 32 fake verified providers around Haret Hreik (33.8547, 35.5097) and wider Beirut, at known distances so the radius tests are exact. 31 providers have a structured price (tutors per hour, repairs per job, doctors per visit, products per item; tutors both under and over $20/hour; one carpenter in LBP). Plus 8 non-verified ones within about 1 km of the centre, so the "include unverified" switch visibly changes results: 6 `unverified` (3 of them `source = 'suggestion'` with no owner) and 2 `pending`. 4 verified providers are sponsored (future `featured_until` and a `sponsor_hook`); a handful of verified providers have active stories and 3 have an active banner.
