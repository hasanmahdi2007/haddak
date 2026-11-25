# Haddak — system design

How the whole system is built, what each part uses, why, and how it will be hosted. Written for the founder: read top to bottom once, then use it as a reference.

Related: `PROJECT.md` (idea and business decisions), `V1_SCOPE.md` (what is in version 1), `SCHEMA.md` (tables), `API.md` (endpoints), `DEPLOY.md` (running it), `PROGRESS.md` (what is built so far).

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
            └───┬──────────┬───┘   │   the backend)          │
                │ SQL      │       └────────────┬────────────┘
                │          │ assistant only     │ same database
                │          ▼                    │
                │   ┌──────────────┐            │
                │   │ Anthropic API│            │
                │   │ (Jarak)      │            │
                │   └──────────────┘            │
                ▼                               ▼
            ┌──────────────────────────────────────────────┐
            │ Postgres 17 + PostGIS + pg_trgm              │
            │ categories, providers, reviews, stories,     │
            │ contact_events, assist_log, ...              │
            └──────────────────────────────────────────────┘
```

Three rules hold the design together:

1. **The app never talks to the database.** Every read and write goes through FastAPI. So all rules (who may see or change what) are in one place, in code that is tested.
2. **Supabase is used as three plain services** — hosted Postgres, login, file storage — not as an application framework. If it ever becomes a problem, Haddak's tables move to any Postgres host with a standard dump and restore. **Sign-in accounts and photos do not move that way**: they live in Supabase's own `auth` schema and in Storage, which the weekly dump does not cover (see `DEPLOY.md`, "Backups").
3. **Nothing is added until a feature needs it.** No queue, no cache server, no microservices in version 1. One API process and one database. The one outside service is the Jarak assistant's call to the Anthropic API (`AI_ASSISTANT.md`), and the app works without it: when the AI is off, slow or over budget, a free keyword search answers instead.

## 2. What each part uses

| Part | Technology | Why this one |
|---|---|---|
| Mobile app | Expo (React Native), TypeScript, Expo Router | One codebase for Android and iOS. You already know React. Test on a real phone with Expo Go, no Android Studio needed at first. |
| Map in the app | `react-native-maps` | Shows Google's map on Android and Apple's on iOS. Displaying a map is a no-cost usage type. |
| API | FastAPI, Pydantic v2 | Types are checked on every request, interactive docs are generated at `/docs` (development only), and the assistant fits in the same codebase. |
| Database access | SQLAlchemy 2 (synchronous), psycopg 3, GeoAlchemy2 | Synchronous code reads top to bottom like Java; easier to learn and debug. Fast enough for this workload. |
| Schema changes | Alembic migrations | Every change to a table is a versioned file in git. A new database is built by replaying them. |
| Database | Postgres 17 with PostGIS and pg_trgm (Supabase) | PostGIS does the radius search inside the database with a spatial index; pg_trgm makes "contains this text" and typo-tolerant matching fast. |
| Login | Supabase Auth (email code) | Free, no SMS costs. The backend only checks the token's signature. |
| Photos and proof | Supabase Storage | Two buckets: `provider-photos` (public) and `verification-docs` (private). |
| Assistant (Jarak) | OpenAI GPT-6 Luna (Google Gemini 3.8 Flash for Arabizi); Claude still selectable by setting (`docs/AI_ASSISTANT.md`, provider switch) | Turns a sentence into the same search parameters the app already sends. Capped by daily and monthly budgets. |
| Tests | pytest against a real PostGIS database | The radius search cannot be tested honestly against a fake database. |
| Code quality | ruff (lint), GitHub Actions on every push | A push that breaks lint or tests shows red on GitHub. |
| Local development | Docker Compose (`postgis/postgis:16-3.4` on port 5433) | Close to production. **One known difference:** production and CI run Postgres **17**, the laptop runs **16**. Moving the laptop to 17 means wiping the local database (a major version cannot reuse the old data folder), so it stays on 16 for now; CI on 17 is what catches version problems. To switch later: `docker compose down -v`, change the image to `postgis/postgis:17-3.5`, `docker compose up -d db`, then `alembic upgrade head` and `python scripts/seed.py`. |

## 3. How a search works (the "Uber-style" part)

The user picks a category and a radius (or types in the search box). The app sends the phone's position:

```
GET /api/v1/providers/search?lat=33.8547&lng=35.5097&radius_m=500&category_id=3&include_unverified=true
```

The backend builds one SQL query (code in `backend/app/services/search.py`):

1. **Filter.** Keep providers inside the circle: `ST_DWithin(location, point, radius)`. The `location` column has a GIST spatial index, so Postgres looks only at rows in the right area. Status: only `verified` ones, unless the request asks for unverified ones too (`include_unverified=true`, which the app and the assistant send by default); then `unverified` and `pending` listings are included. `rejected` never is. A category includes its child categories. The search box (`q`) matches the provider's name, its category (or category group, including aliases such as "سمكري" for plumber) or its area, after `normalize_name()` on both sides; trigram indexes on the normalised name and area make that fast (migration 0019).
2. **Measure.** `ST_Distance` gives metres to each remaining provider. The column type is `geography`, so the maths is done on the Earth's curve and the unit is metres.
3. **Rank.** In this order (each rule only decides between providers equal on the rules before it):
   - with a text search only: providers whose **name** matches first;
   - verified before not verified;
   - among non-verified listings: those with a phone or WhatsApp number first;
   - featured first (verified providers only);
   - weighted rating, highest first;
   - nearest first;
   - provider id, so two requests for the same page always agree.
4. **Count.** The same query returns the number of all matches (`count(*) OVER ()`), so "Showing 20 of N" needs no second query. Results come 20 at a time (`limit`, `offset`).

**Weighted rating.** A provider with one 5-star review should not outrank one with fifty reviews averaging 4.8. So every provider is treated as if it also had 5 extra reviews of 3.5 stars:

```
score = (review_count × avg_rating + 5 × 3.5) / (review_count + 5)
```

One 5-star review scores 3.75. Fifty reviews at 4.8 score 4.68. New providers start in the middle, not at the bottom and not at the top.

Uber's own matching uses a hexagon grid (H3) because it tracks millions of moving cars. Haddak's providers do not move, so a spatial index over fixed points is the right tool and does the same job.

## 4. Data model

Full definitions are in `SCHEMA.md`. In short:

- `categories` — a tree (`parent_id`), with English and Arabic names and search aliases. Adding a profession is a migration that adds a row, not a code change. The API keeps the tree in memory (it only changes with a deploy).
- `providers` — business profiles and listings. A profile belongs to one user (`owner_user_id`, at most one per user); a listing can also have **no owner** (imported from OpenStreetMap, or published from a user's suggestion) until someone claims it. Holds the pin (`location`), contact numbers, prices, photos, the proof document link, `status` (four values: `unverified`, `pending`, `verified`, `rejected`), `featured_until`, and the stored `avg_rating` and `review_count`.
- `reviews` — one per user per provider. When a review is added, changed or removed, the backend recalculates the provider's average in the same transaction, with the provider row locked.
- `contact_events` — one row per profile view, WhatsApp tap or call tap. Counted per month for the provider's stats; old months are rolled up into `contact_event_months` by the retention script (`SCHEMA.md`, "Retention").
- Also: `stories`, `banners`, `follows`, `hire_checks`, `claims`, `provider_suggestions`, `provider_reports`, `places`, and the assistant's `assist_log`, `assist_cache`, `assist_quota`.

## 5. Security

| Concern | How it is handled |
|---|---|
| Who is calling | Supabase issues a signed login token. The backend checks the signature (ES256 public keys from Supabase's JWKS endpoint; HS256 development tokens only when `ALLOW_DEV_TOKENS=true`, which production refuses; unsigned `alg: none` tokens never), the expiry (30 s leeway), the audience and the issuer, refuses Supabase "anonymous" users, then reads the user id. No call to Supabase per request: the public keys are downloaded at most once an hour (5 s timeout) and the last good keys stay in use when a download fails; with no keys at all, login routes answer 503 (not 401, which would sign the app out) and the failure is logged as an error. |
| When Supabase's key endpoint fails | The public keys are downloaded at startup's first use and then at most once an hour, with a 5 s limit per download. If a download fails, the API **keeps using the last keys it had** and tries again only after 30 s, so a Supabase hiccup neither blocks requests nor signs anyone out. Only when it has never had keys does a token check fail, and then with **503** ("sign-in check unavailable"), never 401: the app signs the user out on 401 only. The failure is logged as an error (Sentry). Code: `app/auth.py`, `SigningKeys`. |
| Editing someone else's profile | The API only has "my profile" routes (`/me/provider`). The user id comes from the token, never from the request body. |
| Unverified profiles | `unverified` and `pending` profiles and listings are public without the badge (the founder's choice, so the app is useful before many providers are verified); search includes them only when asked and always after verified ones. `rejected` ones answer 404 everywhere. |
| Admin actions | Separate routes that need the `X-Admin-Key` header. Compared in constant time. With no key configured, every admin call is refused. |
| Fake reviews | Login required, one review per user per provider, no reviewing your own profile. |
| Inflated stats | Contact events are rate-limited, and the same person, provider and event type counts once per 10 minutes. That rule is kept in the database (`contact_event_dedup`, migration 0018), so it survives restarts and would be shared by several API instances. The public "contacts this month" counts only signed-in taps, once per user, provider and day; anonymous taps count only in the owner's private stats. |
| Proof documents | Private storage bucket. Only the owner and the admin see the link. |
| Supabase's automatic Data API | Supabase publishes tables in `public` to anyone holding the app's public key. Haddak does not use it, so every table has Row Level Security with no policies and the `anon`/`authenticated` roles have no privileges (migration 0012, checked by `tests/test_db_security.py`). |
| AI cost abuse | Free daily AI allowance per account or phone and per IP, kept in the database; a daily ($1) and monthly ($10) spending cap; 20 assistant requests per minute per IP; at most 8 AI requests in flight at once. Over any of these, the free keyword search answers. See `AI_ASSISTANT.md`. |
| Oversized requests | Bodies over 64 KB are refused with 413 before they are read into memory (`app/request_limits.py`). |
| Route map | The interactive API docs (`/docs`, `/openapi.json`) are off in production. |
| Secrets | In environment variables. `.env` files are ignored by git from the first commit. |
| Login session on the phone | Encrypted: each value is AES-256 encrypted with a fresh key kept in the phone's secure store (Keystore / Keychain, `expo-secure-store`); only the encrypted value is in AsyncStorage (Supabase's "LargeSecureStore" pattern, `mobile/src/lib/secureStorage.ts`). Android backups are off (`allowBackup: false`). Sign-in links are accepted only as a PKCE `code` this phone asked for; a link carrying tokens is ignored, and a link opened while signed in never switches the account. |
| Bad input | Pydantic validates every field (phone format, coordinate ranges, lengths) before any code runs. All SQL goes through SQLAlchemy with bound parameters. |

Known limits in version 1: the per-minute rate limiter lives in the API's memory, so it is per process and resets on restart. That is fine with one API instance (it only stops bursts). With two instances each would allow the full rate, so the limits move to the database or Redis before a second instance is added. Everything else that must hold across restarts (the assistant's allowance and budgets, the contact-event rule) is in the database.

## 6. Hosting plan

The database is live on Supabase (migrated, locked, OpenStreetMap listings imported, 2026-11-21); the API is deployed on Render from `render.yaml`. The step-by-step runbook is **`docs/DEPLOY.md`**. Prices were checked on 2026-11-21 and change; check each provider's pricing page before paying.

| Piece | Where | Cost to start | Notes |
|---|---|---|---|
| Database, login, storage | Supabase project `wamwmhanxqvftrwqlyfh`, region **Frankfurt** (`eu-central-1`; moved from Seoul on 2026-11-21, see `DEPLOY.md`) | Free tier | Limits below. The Pro plan (about $25/month) removes the pause and adds daily backups of the whole database, sign-in accounts included. Move to Pro before the public launch. |
| API | Render, region Frankfurt (next to the database, about 60 ms from Lebanon), from `render.yaml` | Free; **Starter $7/month before the first outside tester** | Free instances sleep after 15 minutes without requests, and waking takes up to about a minute (longer than a normal request may take). The app softens this (§6, "How the app copes"), but testers would still see slow first screens. Starter does not sleep. |
| Android app | Built with Expo's EAS Build, published on Google Play | $25 once | Updates to JavaScript code can be pushed with EAS Update without a new store review. |
| iPhone app | Later | $99/year | Same codebase. |
| Domain `haddak.app` | Any registrar | About $15/year | Needed for share links (`haddak.app/p/<code>`) and the QR stickers. Not registered yet. |
| Map display | Google Maps SDK through `react-native-maps` | $0 | Needs a Google Cloud account with a card on file. Providers drop their own pin, so no geocoding or Places charges. |
| Jarak AI | Anthropic API | About $1.2 per 1,000 AI searches (eval, 2026-11-20) | Capped in code at $1 a day and $10 a month (`ASSIST_*_BUDGET_USD`); over the cap the free keyword search answers. |
| Crash reports | Sentry, Developer plan | $0 (5,000 errors a month) | Optional (`SENTRY_DSN`). |
| Uptime monitor | UptimeRobot or Better Stack, free plan | $0 | Checks `/api/v1/health` every 5 minutes from outside (`DEPLOY.md`, step 5). |
| Builds | Expo EAS, Free plan | $0 (30 builds a month, low priority) | Starter $19/month only if waiting for builds becomes a problem. |
| Sign-in emails | Gmail SMTP | $0 (about 500 a day) | A transactional email service only when sign-ups pass that. |

Expected total: $0 a month while testing (free tiers, $25 once for Google Play); about $32–45 a month once real users depend on it (Supabase Pro $25 + Render Starter $7 + AI up to $10 + domain about $1).

**Deploy flow.** Push to `main` → GitHub Actions runs lint, tests, a migration run as a production-like role and a Docker build → Render builds the image from `backend/Dockerfile` → migrations run → the API starts. Render deploys only after the GitHub checks pass (`autoDeployTrigger: checksPass`) and sends traffic to the new container once `/api/v1/live` answers.

- **Migrations.** On the free plan the container runs `alembic upgrade head` when it starts (`RUN_MIGRATIONS=true`, the default), because the free plan has no pre-deploy step; that also happens at every wake-up and restart (it is quick when there is nothing to do). On a paid plan, set `preDeployCommand: alembic upgrade head` in `render.yaml` and `RUN_MIGRATIONS=false`: migrations then run once per deploy, and an unreachable database no longer stops the API from starting. Migrations take a Postgres advisory lock (two containers never migrate at once), give up after 5 s waiting for a table lock (`lock_timeout`, so a migration never queues every search behind it), and may run for up to 10 minutes per statement. Indexes on big tables are built `CONCURRENTLY` (example: migration 0019). Code: `backend/alembic/env.py`.
- **Configuration** is by environment variable; `render.yaml` lists every one that production sets: `ENVIRONMENT=production`, `TRUST_PROXY`, `PROXY_HOPS`, `SUPABASE_JWKS_URL`, `SUPABASE_URL`, `CORS_ORIGINS` (empty: the app and `/admin` need no CORS, and production refuses `*`), `ADMIN_API_KEY` and `ASSIST_QUOTA_SECRET` (generated by Render), and the secrets pasted in Render's dashboard: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CONTACT_EMAIL`, `SENTRY_DSN`. The pool and timeout settings (`DB_*`) and `RUN_MIGRATIONS` have safe defaults and are not set there. **`TRUST_PROXY=true` is required on any host with a proxy in front (Render, Railway, Fly.io):** without it every user appears as the proxy's address, so all per-IP limits, including the assistant's 100-a-day IP allowance, would be shared by the whole app.
- **Database role.** On Supabase, `postgis` and `pg_trgm` live in the `extensions` schema, and the backend connects as its own role `haddak_api` (not `postgres`): it owns Haddak's tables, is not a superuser, cannot read Supabase's `auth` or `storage` schemas, has **connection limit 20**, `statement_timeout` 30 s and `idle_in_transaction_session_timeout` 60 s. These settings are written down in **`supabase/role_setup.sql`** (no password in it), so a rebuild does not depend on memory; CI runs the migrations as a role made by that script. It connects through Supabase's session pooler (IPv4; the direct address is IPv6 only). Supabase's Security Advisor shows no warnings for our tables (the only notes are "RLS enabled, no policy", which is the intended lock).

**Connection budget.** Every connection made as `haddak_api` counts against the role's limit of 20, and every connection through the session pooler takes one of the pooler's server connections (about 15 on the free Nano compute; check Supabase → Database → Settings → Connection pooling). The API's share is set in `app/config.py`:

| Who | Connections at most |
|---|---|
| One API instance: `DB_POOL_SIZE` 5 kept + `DB_MAX_OVERFLOW` 3 in a burst | 8 |
| A migration (container start or pre-deploy) | 1 |
| The weekly backup (`pg_dump`) | 1 |
| The founder: SQL editor, psql, `scripts/import_osm.py`, `scripts/retention.py` | 2 |
| **Total** | **12**, under both 15 (pooler) and 20 (role) |

During a deploy the old instance keeps its idle connections (up to 5) for a short while, so the worst moment is about 17: still under the role limit, briefly over the pooler's, where a new client then waits in the pooler's queue. Rule: **instances × (pool + overflow) + 4 ≤ the smaller of the pooler size and 20.** A second instance therefore needs a bigger pooler (Pro) or a smaller pool. `tests/test_reliability.py` checks the default stays inside it.

**Timeouts.** Each layer gives up before the one in front of it, so the user sees a clear answer instead of a hang:

| Layer | Limit | What the user sees |
|---|---|---|
| Waiting for a free database connection | 5 s (`DB_POOL_TIMEOUT_SECONDS`) | 503 `{"detail": ...}`; the app retries a GET |
| Opening a database connection | 5 s (`DB_CONNECT_TIMEOUT_SECONDS`) | 503 |
| One SQL statement (API connections) | 8 s (`DB_STATEMENT_TIMEOUT_MS`, set on each new connection); the role's own limit is 30 s | 503 |
| One AI request (Jarak) | 6 s to answer, 2 s to connect, no retry; at most 8 at once | the keyword-search answer |
| Downloading Supabase's public keys | 5 s, then the last good keys | nothing (or 503 if there never were keys) |
| The app, one try | 15 s (a GET: 30 s per try, the token wait included); a GET is retried on no answer, 502, 503 or 504, with pauses of 2, 4, 8 and 16 s, for up to 60 s in all, but stops after 3 quick "no network" failures (the phone is offline); `/assist` waits 30 s; nothing but GET is repeated by itself; the login token is waited for at most 5 s (a public route then goes without it) | "Waking up the server…" after 8 s; "offline" only after that |

**Errors keep their shape.** Every error answer is JSON `{"detail": "..."}`. A database that is unreachable, busy (no free connection), too slow (statement timeout) or read-only gives **503**, which the app treats as "try again"; any other unexpected error gives **500**. Both are logged as errors with the traceback (Render logs and Sentry). Code: `app/main.py`.

**Health checks.** Two endpoints, on purpose:
- `/api/v1/live` — the process answers; touches nothing else. Render's `healthCheckPath`. If it checked the database, a database outage or a full pool would make Render restart a healthy API (and wipe its in-memory rate limits) without fixing anything.
- `/api/v1/health` — also runs `SELECT 1`. For the external uptime monitor, the smoke test and the app's warm-up ping.

**How the app copes with a sleeping or busy server** (rules in `mobile/src/api/http.ts`, the mobile agent's work of 2026-11-25): at start the app sends one quiet warm-up request to `/health` that may wait 75 s, so the free server is usually awake by the time the first screen asks for data; while a request waits for a waking server the app shows "Waking up the server…"; GETs are retried as in the timeouts table; POST, PUT and DELETE are never repeated by the app itself (the first one may have reached the server), and a profile created by a request that timed out is found again with `GET /me/provider`.

**Free-plan limits and what each does to the app** (Supabase free plan, from the pricing page as remembered on 2026-11-25; check it):

| Limit | What happens when it is reached | What protects us now | Real fix |
|---|---|---|---|
| Database 500 MB | Supabase switches the database to **read-only**. Reads work; every write fails: reviews, follows, profile edits, contact events, stories answer 503. The assistant still answers (its log and cache writes are best-effort), but cannot count allowances, so it uses keywords only. | `scripts/retention.py` (old stories, assist log, contact events rolled up into monthly totals); `contact_events` was the fastest-growing table. Check the size in Supabase → Reports → Database monthly. | Pro (8 GB included). |
| Storage 1 GB | Photo and story uploads fail. About 4,000–6,000 resized photos. | Photos are resized on the phone before upload. | Pro (100 GB). |
| Egress about 5 GB a month | Supabase may restrict the project. A results page with full-size photos is a few MB. | Resizing on upload. | Thumbnails in lists; Pro (250 GB). |
| Pause after 7 days without activity | The database is off: the API's `/health` and every data route answer 503 (the API itself stays up, because Render checks `/live`). | Any real use, the uptime monitor and the app's warm-up count as activity (probably; not confirmed). | Pro has no pause. Restore from the dashboard. |
| Shared Nano CPU, about 15 pooler connections | Slow queries under load; connections wait in the pooler. | The connection budget above; indexes for every search path. | Pro with a larger compute. |

**Environments.** Local (Docker database, development token script) and production. A separate staging environment is not worth the cost until there is a second developer.

**Backups.** Supabase's paid plan keeps daily backups of the whole database. Until then `.github/workflows/backup.yml` runs `pg_dump` of schema `public` every Monday, encrypts it (the repository is public) and keeps it 30 days as a workflow artifact; it can also dump the sign-in accounts when the founder adds a second secret. It does **not** cover photos in Storage. RPO (data that can be lost): up to 7 days. The full rebuild order (role, extensions, restore, functions, storage rules, sign-in settings) is in `DEPLOY.md`, "Rebuilding everything"; a restore of `public` was tested on 2026-11-21.

**Knowing when it breaks.**
- Crash reports go to Sentry when `SENTRY_DSN` is set (`app/error_tracking.py`; errors only, no IP, query string, body or auth headers). Error-level log lines go there too: database errors, a missing account-deletion function, a failed key download, and the first time each day or month the assistant's budget is reached.
- Every response carries an `X-Request-ID` header; the same id is in the request's log line and on its Sentry report, so a user's "it failed at 21:04" can be matched to the exact error.
- An external uptime monitor (UptimeRobot or Better Stack, every 5 minutes, email or push) checks `/api/v1/health`. That is the founder's step 5 in `DEPLOY.md`. `.github/workflows/uptime.yml` also runs `backend/scripts/smoke_test.py` every 30 minutes once `API_URL` is set, but GitHub's schedule is often late, so it is the second line, not the first.
- Slow queries: Supabase → Reports → Query performance (based on `pg_stat_statements`). Look at it weekly while the app is young.
- Not alerted yet: the database nearing 500 MB (check the Supabase report monthly) and a failed weekly backup (GitHub emails only if Actions notifications are on).

**Speed and region.** A search makes about 6 to 10 database round trips, depending on whether it has a category or a text: the connection check (pool ping), the transaction, with `q` the normalising and the category match, the main query (which also returns the total), and for the home screen the stories and banners. The category tree is read once per process, not per search. So the API must sit next to the database. Measured on 2026-11-21 from a laptop in Lebanon: about 2.5 s per search against the old Seoul database, 0.8 s against Frankfurt. With Render also in Frankfurt the database part is a few milliseconds and the user mostly waits for the trip from Lebanon to Frankfurt and back (about 60 ms).

**Account deletion and policies.** `DELETE /api/v1/me` and the in-app "Account and privacy" screen delete everything about a user (Google Play requirement); `/privacy`, `/terms` and `/delete-account` are served by the API. In production, if the function that deletes the sign-in account is missing (for example after a rebuild), the endpoint refuses with 503 and deletes nothing, instead of reporting success.

**Checks on every push** (`.github/workflows/`): backend lint, formatting, known-vulnerability audit of the dependencies (`pip-audit`), the full test suite against Postgres 17 + PostGIS (the version Supabase runs), the migrations run again as a non-superuser role made by `supabase/role_setup.sql` with the extensions in an `extensions` schema (like production), and a `docker build` of the API image; mobile type check and lint. Both workflows can only read the repository (`permissions: contents: read`). Dependabot opens weekly update pull requests (`.github/dependabot.yml`); GitHub secret scanning with push protection blocks a commit that contains a key.

## 7. How far this design scales

The founder's goal is an everyday app for a whole country. This design is deliberately small, and it reaches further than it looks:

- **Up to tens of thousands of providers:** one API instance and one database, if the measured capacity (below) covers the peak. The search is one indexed query.
- **Next step:** two or three API instances behind the host's load balancer. Before that, the per-minute rate limiter must move to the database or Redis (it is the one piece of state still kept in the API's memory; everything else already is in the database), and the connection budget (§6) must allow it.
- **After that:** a read replica for searches. Standard Postgres.

Lebanon has about 5 million people. One well-indexed Postgres database is enough for the whole country.

**Capacity is not measured yet.** One uvicorn process uses at most one CPU core, and Render Starter gives it half a core. Reading the code, a 20-result search costs roughly 10–20 ms of CPU on a full core and the 100-result map query about three times that, which suggests roughly 15–25 list searches a second on Starter, or 5–8 when every list also loads the map, and only a few a second on the free plan's 0.1 CPU. **These are estimates.** Before launch, run `backend/scripts/load_test.py` against a Starter instance with production-like data (3,000+ listings) and write the real numbers here.

### 7.1 Decision record: Supabase and a small container host, not AWS (2026-11-15)

**Question.** If the app succeeds, is Supabase enough, or is AWS needed?

**Estimate of a successful Haddak.** These are assumptions, not measurements; replace them with real numbers after launch.

| Quantity | Assumption | Result |
|---|---|---|
| People | Lebanon about 5.5 million, Greater Beirut about 2 million | A national success is on the order of 100,000 monthly users |
| Providers | | 5,000 to 20,000 |
| Requests | 100,000 users × about 50 API calls a month (searches, profiles, reviews) | 5 million a month: about 2 a second on average, perhaps 20 to 30 a second at the evening peak |
| Database size | 20,000 providers, 500,000 reviews, about 10 million contact events a year | Roughly 1 to 2 GB after a year without retention; much less with the monthly roll-up of contact events |
| Photos stored | 20,000 providers × 5 photos × about 300 KB | About 30 GB |

**What that needs.** A radius search is one indexed query that takes a few milliseconds in the database. The limit is more likely the API's CPU than the database: the estimate in §7 (15–25 searches a second on one Starter instance) is close to the assumed peak, so **the margin is unknown until the load test is run**; plan for a bigger instance (Standard, 1 CPU) or two instances (after moving the rate limiter) if the measurement is close. The paid Supabase plan's included database size, file storage and login users are (from memory; check the pricing page) each several times these numbers.

**Decision.** Launch on Supabase plus one container host. Do not use AWS now.

**Why.**
- Capacity is not the constraint at any realistic size for one country.
- The constraint is the founder's time. The validation benchmark is 50 real providers; AWS setup (networking, permissions, database, containers, load balancer) costs days and adds no provider.
- AWS would cost more for the same load and is harder to predict.
- Leaving later is cheap by design: the database is standard Postgres (export and import), the backend is a standard Docker image, and the app talks only to our API. Only login would need a migration plan.

**What breaks first, and the fix.** None of these is solved by AWS as such.

| Pressure point | When | Fix |
|---|---|---|
| Render free plan: sleeping, 0.1 CPU | The first outside tester | Starter ($7) |
| Supabase free plan: 500 MB read-only, pause, 1 GB storage | Public launch, or earlier with heavy use | Pro ($25); retention script until then |
| API CPU on one instance | Evening peak after a mention on TV or social media | Measure (load test); a bigger instance; then two instances with shared limits |
| Photo bandwidth: full-size photos sent to every phone | Well before the database is stressed | Resize on upload (done), small thumbnails in lists, long cache headers, a CDN in front of storage |
| Rate limiter kept in one process's memory | When a second API instance is needed | Move the counters to Postgres or Redis |
| `contact_events` grows without limit | After months of real use | Monthly roll-up into `contact_event_months` (`scripts/retention.py`, done) |
| Search load | Far beyond a national success | Read replica for searches |

**Revisit this decision when** any of these is true: the monthly bill passes about $150; a feature needs something these hosts lack (background workers, a queue); the app expands beyond Lebanon and needs several regions; or a customer or investor requires a specific cloud.

## 8. What comes later, and where it plugs in

| Later feature | Where it fits |
|---|---|
| Semantic matching of categories | `pgvector` extension in the same Postgres. No new database. |
| Featured placement payments | Collected by hand at first (Whish, OMT, cash); the admin sets `featured_until`. The column and ranking are already there. |
| Admin panel | A simple approval page ships with the API (see `API.md`). A fuller panel only when volume needs it. |
| Booking and commission | New tables and endpoints in the same API. |
| Queues and scheduled jobs | Only when there is slow background work, such as sending notifications in bulk. Until then, maintenance (retention) is a script the founder runs. |

(The AI assistant, once listed here as "later", shipped in November 2026: `AI_ASSISTANT.md`.)

## 9. Repository layout

```
backend/     FastAPI app
  app/routers/    one file per group of endpoints
  app/services/   search, ratings, assistant, geometry helpers
  app/models.py   tables as Python classes
  app/schemas.py  request and response shapes
  alembic/        database migrations
  scripts/        seed data, development login token, OSM import, retention, load test, smoke test
  tests/          pytest suite (runs against real PostGIS)
mobile/      Expo app; design system in mobile/DESIGN.md
supabase/    SQL applied by hand on Supabase (role, auth function, storage rules), email template
docs/        this file and the other project records
.github/workflows/   lint, tests, image build, backups, uptime
docker-compose.yml   local database
```
