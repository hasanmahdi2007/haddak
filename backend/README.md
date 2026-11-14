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

## Tour of the code

A request travels: **router** (reads and validates the request) → **service**
(the logic and the queries) → **models** (the tables) → back out through a
**schema** (the JSON shape).

```
app/
  main.py            Creates the app, adds the routers under /api/v1, health check.
  config.py          Settings read from environment variables / .env.
  db.py              Database connection; get_db gives each request a session.
  models.py          One class per table (Category, Provider, Review, ContactEvent).
  schemas.py         JSON shapes in and out, with validation (phone format, 1-5 rating...).
  auth.py            Checks login tokens (user id from "sub") and the admin key.
  routers/
    categories.py    GET /categories
    providers.py     Public: search, detail, by-slug, contact events
    reviews.py       List reviews; create/update/delete my review
    me.py            My own profile: create, read, update, monthly stats
    admin.py         List by status; verify / reject / feature
  services/
    search.py        The radius search query and its ranking
    ratings.py       Recalculates avg_rating and review_count from the reviews
    provider_views.py  Converts a Provider row to Summary / Detail / Own JSON
    geo.py           Helpers for map points (PostGIS wants longitude first)
alembic/             Migrations. versions/0001_initial_schema.py is the SQL from SCHEMA.md.
scripts/
  seed.py            Fake categories, providers and reviews for development
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
- **Who can see what.** Public routes only ever return `verified` providers;
  pending and rejected ones answer 404, as if they did not exist. Private
  fields (`status`, `verification_doc_url`, `featured_until`) exist only in
  the `OwnProvider` schema, which only the owner and admin routes return.
- **Ranking.** Featured first, then a weighted rating, then distance. The
  weighted rating is explained at the top of `services/search.py`.
- **Ratings stay correct.** Writing a review and updating the provider's
  average happen in one transaction, with the provider row locked, so two
  simultaneous reviews cannot leave a wrong average.
- **Dates are UTC.** "Featured until" and "this month" in stats use the UTC date.
- **Seed data.** Providers sit at exact distances from Haret Hreik
  (33.8547, 35.5097): 8 within 500 m, 7 more within 1 km, 11 more within 5 km,
  4 further out (5.6, 9, 17 and 36 km), plus 2 pending ones that must never show up.
