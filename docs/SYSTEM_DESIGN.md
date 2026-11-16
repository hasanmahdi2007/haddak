# Haddak — system design

How the whole system is built, what each part uses, why, and how it will be hosted. Written for the founder: read top to bottom once, then use it as a reference.

Related: `PROJECT.md` (idea and business decisions), `V1_SCOPE.md` (what is in version 1), `SCHEMA.md` (tables), `API.md` (endpoints), `PROGRESS.md` (what is built so far).

## 1. The system in one picture

```
                    ┌───────────────────────────┐
                    │  Phone: Haddak app        │
                    │  Expo / React Native / TS │
                    └───┬───────────────┬───────┘
        JSON over HTTPS │               │ login, photo upload
     (every search,     │               │ (only these two things)
      profile, review)  ▼               ▼
            ┌──────────────────┐   ┌─────────────────────────┐
            │ FastAPI backend  │   │ Supabase                │
            │ Python 3.12      │   │  Auth    → login tokens │
            │ all rules live   │◀──│  Storage → photo files  │
            │ here             │   │  (token verified by     │
            └────────┬─────────┘   │   the backend)          │
                     │ SQL         └────────────┬────────────┘
                     ▼                          │ same database
            ┌──────────────────────────────────────────────┐
            │ Postgres 16 + PostGIS                        │
            │ categories, providers, reviews,              │
            │ contact_events                               │
            └──────────────────────────────────────────────┘
```

Three rules hold the design together:

1. **The app never talks to the database.** Every read and write goes through FastAPI. So all rules (who may see or change what) are in one place, in code that is tested.
2. **Supabase is used as three plain services** — hosted Postgres, login, file storage — not as an application framework. If it ever becomes a problem, the database moves to any Postgres host with a standard dump and restore.
3. **Nothing is added until a feature needs it.** No queue, no cache server, no AI service, no microservices in version 1. One API process and one database.

## 2. What each part uses

| Part | Technology | Why this one |
|---|---|---|
| Mobile app | Expo (React Native), TypeScript, Expo Router | One codebase for Android and iOS. You already know React. Test on a real phone with Expo Go, no Android Studio needed at first. |
| Map in the app | `react-native-maps` | Shows Google's map on Android and Apple's on iOS. Displaying a map is a no-cost usage type. |
| API | FastAPI, Pydantic v2 | Types are checked on every request, interactive docs are generated at `/docs`, and the later AI search fits in the same codebase. |
| Database access | SQLAlchemy 2 (synchronous), psycopg 3, GeoAlchemy2 | Synchronous code reads top to bottom like Java; easier to learn and debug. Fast enough for this workload. |
| Schema changes | Alembic migrations | Every change to a table is a versioned file in git. A new database is built by replaying them. |
| Database | Postgres 16 with PostGIS | PostGIS does the radius search inside the database with a spatial index. |
| Login | Supabase Auth (Google or email) | Free, no SMS costs. The backend only checks the token's signature. |
| Photos and proof | Supabase Storage | Two buckets: `provider-photos` (public) and `verification-docs` (private). |
| Tests | pytest against a real PostGIS database | The radius search cannot be tested honestly against a fake database. |
| Code quality | ruff (lint), GitHub Actions on every push | A push that breaks lint or tests shows red on GitHub. |
| Local development | Docker Compose (`postgis/postgis:16-3.4` on port 5433) | The same database engine as production, on your laptop. |

## 3. How a search works (the "Uber-style" part)

The user picks a category and a radius. The app sends the phone's position:

```
GET /api/v1/providers/search?lat=33.8547&lng=35.5097&radius_m=500&category_id=3
```

The backend runs one SQL query (code in `backend/app/services/search.py`):

1. **Filter.** Keep providers that are `verified` and inside the circle: `ST_DWithin(location, point, radius)`. The `location` column has a GIST spatial index, so Postgres does not measure the distance to every row; it looks only at rows in the right area. This stays fast with hundreds of thousands of providers.
2. **Measure.** `ST_Distance` gives metres to each remaining provider. The column type is `geography`, so the maths is done on the Earth's curve and the unit is metres.
3. **Rank.** In this order:
   - featured providers first (`featured_until` is today or later);
   - then weighted rating, highest first;
   - then nearest first.

**Weighted rating.** A provider with one 5-star review should not outrank one with fifty reviews averaging 4.8. So every provider is treated as if it also had 5 extra reviews of 3.5 stars:

```
score = (review_count × avg_rating + 5 × 3.5) / (review_count + 5)
```

One 5-star review scores 3.75. Fifty reviews at 4.8 score 4.68. New providers start in the middle, not at the bottom and not at the top.

Uber's own matching uses a hexagon grid (H3) because it tracks millions of moving cars. Haddak's providers do not move, so a spatial index over fixed points is the right tool and does the same job.

## 4. Data model

Full definitions are in `SCHEMA.md`. In short:

- `categories` — a tree (`parent_id`), with English and Arabic names. Adding a profession is adding a row, not changing code.
- `providers` — one profile per user. Holds the pin (`location`), contact numbers, price text, photos, the proof document link, `status` (`pending` → `verified` or `rejected`), `founding_member`, `featured_until`, and the stored `avg_rating` and `review_count`.
- `reviews` — one per user per provider. When a review is added, changed or removed, the backend recalculates the provider's average in the same transaction.
- `contact_events` — one row per profile view, WhatsApp tap or call tap. Counted per month for the provider's stats. This is the evidence used later to sell featured placement.

## 5. Security

| Concern | How it is handled |
|---|---|
| Who is calling | Supabase issues a signed login token. The backend checks the signature (ES256 public keys from Supabase's JWKS endpoint; HS256 development tokens only when `ALLOW_DEV_TOKENS=true`, which production refuses; unsigned `alg: none` tokens never), the expiry and the audience, then reads the user id. No call to Supabase per request. |
| Editing someone else's profile | The API only has "my profile" routes (`/me/provider`). The user id comes from the token, never from the request body. |
| Unapproved profiles | Not returned by search, detail, reviews or contact routes until `status = verified`. |
| Admin actions | Separate routes that need the `X-Admin-Key` header. Compared in constant time. With no key configured, every admin call is refused. |
| Fake reviews | Login required, one review per user per provider, no reviewing your own profile. |
| Inflated stats | Contact events are rate-limited per IP and the same IP, provider and type counts once per 10 minutes (being added, see `PROGRESS.md`). |
| Proof documents | Private storage bucket. Only the owner and the admin see the link. |
| Secrets | In environment variables. `.env` files are ignored by git from the first commit. |
| Bad input | Pydantic validates every field (phone format, coordinate ranges, lengths) before any code runs. All SQL goes through SQLAlchemy with bound parameters. |

Known limits in version 1: the rate limiter lives in the API's memory, so it is per process and resets on restart. That is fine with one API instance. With several instances it moves to Redis or the database.

## 6. Hosting plan

Nothing is hosted yet. This is the plan for when the app is ready for real users. Prices are from memory and change; check each provider's pricing page before paying.

| Piece | Where | Cost to start | Notes |
|---|---|---|---|
| Database, login, storage | Supabase, region Frankfurt (closest to Lebanon) | Free tier | Free projects pause after about a week with no activity; the paid plan (about $25/month) removes that and adds daily backups. Move to paid when real providers depend on it. |
| API | A container host in the same region: Render, Railway or Fly.io | Free or about $5–7/month | The backend ships as a Docker image, so any of them works. Free instances sleep when idle and the first request after a sleep is slow; the small paid instance does not sleep. |
| Android app | Built with Expo's EAS Build, published on Google Play | $25 once | Updates to JavaScript code can be pushed with EAS Update without a new store review. |
| iPhone app | Later | $99/year | Same codebase. |
| Domain `haddak.app` | Any registrar | About $15/year | Needed for share links (`haddak.app/p/<code>`) and the QR stickers. Not registered yet. |
| Map display | Google Maps SDK through `react-native-maps` | $0 | Needs a Google Cloud account with a card on file. Providers drop their own pin, so no geocoding or Places charges. |

Expected total once live: about $30–40 a month, close to $0 while building.

**Deploy flow.** Push to `main` → GitHub Actions runs lint and tests → the host builds the Docker image from `backend/Dockerfile` → on start the container runs `alembic upgrade head` (applies any new migration) and then starts the API. Configuration is by environment variable: `DATABASE_URL`, `SUPABASE_JWKS_URL`, `ADMIN_API_KEY`, `CORS_ORIGINS`.

**Environments.** Local (Docker database, development token script) and production. A separate staging environment is not worth the cost until there is a second developer.

**Backups.** Supabase's paid plan keeps daily backups. Before that, a weekly `pg_dump` to your own storage is enough.

## 7. How far this design scales

The founder's goal is an everyday app for a whole country. This design is deliberately small, and it reaches further than it looks:

- **Up to tens of thousands of providers and hundreds of thousands of searches a day:** one small API instance and one database. The search is one indexed query.
- **Next step:** two or three API instances behind the host's load balancer. The API keeps no state between requests, so this is a setting, not a rewrite. The rate limiter moves to Redis at that point.
- **After that:** a read replica for searches, and caching the category list. Both are standard Postgres and HTTP features.

Lebanon has about 5 million people. One well-indexed Postgres database is enough for the whole country.

### 7.1 Decision record: Supabase and a small container host, not AWS (2026-11-15)

**Question.** If the app succeeds, is Supabase enough, or is AWS needed?

**Estimate of a successful Haddak.** These are assumptions, not measurements; replace them with real numbers after launch.

| Quantity | Assumption | Result |
|---|---|---|
| People | Lebanon about 5.5 million, Greater Beirut about 2 million | A national success is on the order of 100,000 monthly users |
| Providers | | 5,000 to 20,000 |
| Requests | 100,000 users × about 50 API calls a month (searches, profiles, reviews) | 5 million a month: about 2 a second on average, perhaps 20 to 30 a second at the evening peak |
| Database size | 20,000 providers, 500,000 reviews, about 10 million contact events a year | Roughly 1 to 2 GB after a year |
| Photos stored | 20,000 providers × 5 photos × about 300 KB | About 30 GB |

**What that needs.** A radius search is one indexed query that takes a few milliseconds, so one small API instance and one small Postgres database handle the peak with a large margin. The paid Supabase plan's included database size, file storage and login users are (from memory; check the pricing page) each several times these numbers.

**Decision.** Launch on Supabase plus one container host. Do not use AWS now.

**Why.**
- Capacity is not the constraint at any realistic size for one country.
- The constraint is the founder's time. The validation benchmark is 50 real providers; AWS setup (networking, permissions, database, containers, load balancer) costs days and adds no provider.
- AWS would cost more for the same load and is harder to predict.
- Leaving later is cheap by design: the database is standard Postgres (export and import), the backend is a standard Docker image, and the app talks only to our API. Only login would need a migration plan.

**What breaks first, and the fix.** None of these is solved by AWS as such.

| Pressure point | When | Fix |
|---|---|---|
| Photo bandwidth: full-size photos sent to every phone | First, well before the database is stressed | Resize on upload, serve small thumbnails in lists, long cache headers, a CDN in front of storage |
| Rate limiter kept in one process's memory | When a second API instance is needed | Move the counters to Redis |
| `contact_events` grows without limit | After about a year of real use | Monthly summary table; archive old rows |
| Search load | Far beyond a national success | Read replica for searches |

**Revisit this decision when** any of these is true: the monthly bill passes about $150; a feature needs something these hosts lack (background workers for AI search, a queue); the app expands beyond Lebanon and needs several regions; or a customer or investor requires a specific cloud.

## 8. What comes later, and where it plugs in

| Later feature | Where it fits |
|---|---|
| AI search ("i need some1 fix my laptop near me") | One new endpoint. A small model turns the sentence into the same parameters the search already takes (`category_id`, `radius_m`, `q`). The search query does not change. Cost is one small model call per typed search. |
| Semantic matching of categories | `pgvector` extension in the same Postgres. No new database. |
| Featured placement payments | Collected by hand at first (Whish, OMT, cash); the admin sets `featured_until`. The column and ranking are already there. |
| Admin panel | A simple approval page ships with the API (see `API.md`). A fuller panel only when volume needs it. |
| Booking and commission | New tables and endpoints in the same API. |
| Queues | Only when there is slow background work, such as sending notifications in bulk. |

## 9. Repository layout

```
backend/     FastAPI app
  app/routers/    one file per group of endpoints
  app/services/   search, ratings, geometry helpers
  app/models.py   tables as Python classes
  app/schemas.py  request and response shapes
  alembic/        database migrations
  scripts/        seed data, development login token
  tests/          pytest suite (runs against real PostGIS)
mobile/      Expo app; design system in mobile/DESIGN.md
docs/        this file and the other project records
.github/workflows/   lint and tests on every push
docker-compose.yml   local database
```
