# Haddak backend

FastAPI + SQLAlchemy + Postgres/PostGIS. The contract it implements is in
`../docs/API.md`; the database schema is in `../docs/SCHEMA.md`.

## Setup (once)

From the repository root, start the database:

```bash
docker compose up -d db
```

Then, in `backend/` (Git Bash; in PowerShell use `.venv\Scripts\Activate.ps1`):

```bash
py -3.12 -m venv .venv
source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env          # then edit the secrets in .env
```

## Everyday commands

Run these in `backend/` with the virtualenv active.

| What | Command |
|---|---|
| Create / update the tables | `alembic upgrade head` |
| Fill the database with fake data | `python scripts/seed.py` |
| Run the server | `uvicorn app.main:app --reload` |
| Run the tests | `pytest` |
| Check code style | `ruff check .` (and `ruff format .` to tidy) |
| Get a login token for testing | `python scripts/dev_token.py` |

With the server running:

- Interactive docs: http://localhost:8000/docs
- Admin page (approve / reject profiles): http://localhost:8000/admin — asks for `ADMIN_API_KEY`
- Try it: http://localhost:8000/api/v1/providers/search?lat=33.8547&lng=35.5097&radius_m=500

To let a phone on the same Wi-Fi reach the server, run
`uvicorn app.main:app --reload --host 0.0.0.0` and use the computer's IP address.

### Logging in before Supabase exists

`python scripts/dev_token.py` prints a token for a new random user (or pass a
user UUID to reuse one). Send it as `Authorization: Bearer <token>`. It is
signed with `SUPABASE_JWT_SECRET` from `.env`, exactly like a Supabase token.

Admin routes use the header `X-Admin-Key` with the value of `ADMIN_API_KEY`.

### Tests

Tests use a real PostGIS database named `haddak_test` on the same Docker
server, never the development database. You do not have to create it: the
test setup creates it if missing, runs the Alembic migration, and empties the
tables before every test. Set `TEST_DATABASE_URL` to use a different server.

### Changing the database

1. Change `../docs/SCHEMA.md`.
2. `alembic revision -m "what changed"` and write the SQL in the new file under `alembic/versions/`.
3. Update the class in `app/models.py`.
4. `alembic upgrade head`.

## Deploying

The `Dockerfile` builds the production image. On start it runs
`alembic upgrade head`, then uvicorn on `$PORT` (8000 if not set), as a
non-root user.

```bash
docker build -t haddak-api .
docker run -p 8000:8000 -e ENVIRONMENT=production -e DATABASE_URL=... -e ADMIN_API_KEY=... \
  -e SUPABASE_JWKS_URL=... -e CORS_ORIGINS= -e TRUST_PROXY=true haddak-api
```

Set these environment variables on the hosting platform (never in the image):

| Variable | Production value |
|---|---|
| `ENVIRONMENT` | `production`. Turns on the startup safety check below. |
| `DATABASE_URL` | The Postgres connection string. The database must allow the PostGIS extension (Supabase does). `postgresql://...` is fine; the driver is added automatically. |
| `SUPABASE_JWKS_URL` **or** `SUPABASE_JWT_SECRET` | How login tokens are verified. Prefer the JWKS URL (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`); if it is set, the secret is ignored. |
| `ADMIN_API_KEY` | A long random value: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. |
| `CORS_ORIGINS` | Empty, unless a website on another domain must call the API (then list it, e.g. `https://haddak.app`). Never `*`. The phone app and `/admin` do not need CORS. |
| `TRUST_PROXY` | `true` when the platform puts a proxy in front of the app (Render, Railway, Fly.io and similar do). Rate limits then use the real client IP from `X-Forwarded-For`. `false` if the server is reached directly. |
| `PROXY_HOPS` | How many trusted proxies are in front (default 1). The client IP is read that many entries from the right of `X-Forwarded-For`, so a client cannot fake it. Check on the real host after the first deploy. |

Good to know:

- **Startup safety.** With `ENVIRONMENT=production` the server refuses to start
  if `ADMIN_API_KEY` is empty or still starts with `change-me`, or if neither
  token setting is configured. The error message says which.
- **Health check.** Point the platform's health check at `/api/v1/health`. It
  answers 503 when the database cannot be reached.
- **One instance.** Rate limits are kept in the process's memory, so run a
  single instance with a single worker (the Dockerfile does). See the note at
  the top of `app/rate_limit.py`.
- **Logs.** One line per request: method, path, status, duration. Query
  strings (users' positions) and headers (tokens, admin key) are never logged.
  If you start uvicorn yourself in production, add `--no-access-log`, because
  uvicorn's own access log does print query strings.
- **Admin page.** `https://<your-domain>/admin`. Use it only over HTTPS; the
  key stays in the tab's memory and is gone on reload.
- **No fake data.** Do not run `scripts/seed.py` against production.

## Tour of the code

A request travels: **router** (reads and validates the request) → **service**
(the logic and the queries) → **models** (the tables) → back out through a
**schema** (the JSON shape).

```
app/
  main.py            Creates the app, adds the routers under /api/v1, health check.
  config.py          Settings read from environment variables / .env.
  db.py              Database connection; get_db gives each request a session.
  models.py          One class per table (Category, Provider, Review, ContactEvent,
                     ProviderSuggestion, ProviderReport, Story, Banner, Follow).
  schemas.py         JSON shapes in and out, with validation (phone format, 1-5 rating...).
  auth.py            Checks login tokens (user id from "sub") and the admin key.
  rate_limit.py      Per-IP limits on write routes and suggestions, contact-event de-duplication.
  request_logging.py One log line per request (no query string, no headers).
  static/admin.html  The founder's admin page, served at /admin.
  routers/
    categories.py    GET /categories
    providers.py     Public: search, detail, by-slug, contact events, reports
    reviews.py       List reviews; create/update/delete my review
    me.py            My own profile: create, read, update, monthly stats
    suggestions.py   Public: suggest a provider who is not on Haddak yet
    posts.py         Stories and banners: post / delete mine, a provider's stories,
                     stories nearby
    follows.py       Follow / unfollow a provider, my following list, my feed
    admin.py         List by status; verify / reject / feature; suggestions; reports;
                     delete any story or banner
  services/
    search.py        The radius search query and its ranking
    ratings.py       Recalculates avg_rating and review_count from the reviews
    provider_views.py  Converts a Provider row to Summary / Detail / Own JSON
    geo.py           Helpers for map points (PostGIS wants longitude first)
    opening_hours.py "Open now" from a provider's opening hours (Beirut time)
    contact_stats.py Start of the stats month; the optional public contact count
    posts.py         Which stories and banners are active now (filtered by time)
    follows.py       Follower count, "do I follow this provider"
    story_feed.py    Stories grouped by provider, for "nearby" and "my feed"
alembic/             Migrations, as SQL matching SCHEMA.md:
                     versions/0001_initial_schema.py (the first four tables),
                     versions/0002_contact_count_hours_suggestions.py (two provider
                     columns and the provider_suggestions table),
                     versions/0003_unverified_listings_reports.py (the unverified
                     status, listings without an owner, provider_reports),
                     versions/0004_stories_banners_follows_sponsor_hook.py (stories,
                     banners, follows, providers.sponsor_hook).
scripts/
  seed.py            Fake categories, providers, reviews, stories and banners
  dev_token.py       Prints a login token for testing
tests/               pytest; conftest.py has the database setup and helpers
(CI)                 GitHub Actions workflow lives at ../.github/workflows/backend.yml
```

Things worth knowing:

- **Java comparison.** A router is like a Spring `@RestController`; `Depends(get_db)`
  is dependency injection; Pydantic schemas are DTOs with validation annotations;
  SQLAlchemy models are JPA entities; Alembic is Flyway.
- **Why `GEOGRAPHY`.** The `location` column stores a point on the globe, so
  PostGIS measures distances in real metres. `provider.lat` / `provider.lng`
  are computed from it on every load (see the comment in `models.py`).
- **Provider statuses.** A provider can be listed without being verified:

  | Status | Public? | Meaning |
  |---|---|---|
  | `unverified` | listed, no badge | No proof sent, or the proof was not accepted. |
  | `pending` | listed, no badge | Proof sent, waiting for the founder. |
  | `verified` | listed, with the badge | The founder checked the proof. |
  | `rejected` | hidden (404) | Fake, abusive or duplicate. |

  Search returns verified providers only unless `include_unverified=true`.
  The public never receives the raw status, only `verified: true/false`.
  Private fields (`status`, `verification_doc_url`, `featured_until`) exist
  only in the `OwnProvider` schema, which only the owner and admin routes return.
- **Ranking.** Verified first, then featured (sponsored), then a weighted
  rating, then distance. Explained at the top of `services/search.py`.
- **Stories and banners.** Only the owner of a verified provider may post. A
  story lives 24 hours (at most 5 active per provider); a banner is the
  provider's one current offer and runs 1 to 7 days. Nothing deletes expired
  rows: the queries in `services/posts.py` simply filter them out by time.
- **Follows.** A signed-in user can follow any public provider.
  `GET /me/feed` shows the active stories of the providers they follow.
- **Sponsored.** "Featured" is shown to users as "Sponsored": `sponsored` is
  true for a verified provider whose `featured_until` has not passed. The
  owner writes a one-sentence `sponsor_hook`; the public only receives it
  while the provider is sponsored. The admin sets `featured_until` by hand
  (no payments in the app yet).
- **No N+1 queries.** A list of providers loads the stories and banners of the
  whole page with two queries (`to_summaries` in `services/provider_views.py`),
  not two per provider.
- **Ratings stay correct.** Writing a review and updating the provider's
  average happen in one transaction, with the provider row locked, so two
  simultaneous reviews cannot leave a wrong average.
- **Dates are UTC.** "Featured until" and "this month" in stats use the UTC date.
- **Seed data.** Providers sit at exact distances from Haret Hreik
  (33.8547, 35.5097): 8 within 500 m, 7 more within 1 km, 11 more within 5 km,
  4 further out (5.6, 9, 17 and 36 km). Those 30 are verified; 4 of them are
  sponsored. Plus 2 pending and 6 unverified ones within 1 km (3 of the
  unverified have no owner: "listed by the community"), which only show up in
  search with `include_unverified=true`. A few verified providers have active
  stories and 3 have a banner; running the seed again refreshes them. Every
  phone number is `+9610000xxxx`, which cannot be dialled.
