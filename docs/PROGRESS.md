# Haddak — progress log

What has been built, how it was checked, and what is still open. Newest entry first. The task board with per-task status is `TASKS.md`.

## Where things stand

| Area | State |
|---|---|
| Project docs | Written: PROJECT, V1_SCOPE, SCHEMA, API, SYSTEM_DESIGN, TASKS, this log |
| GitHub | Private repo https://github.com/hasanmahdi2007/haddak, CI running |
| Local database | Postgres 16 + PostGIS in Docker, port 5433, seeded |
| Backend | All version 1 endpoints built and tested |
| Mobile app | In progress |
| Hosting | Not started (plan in `SYSTEM_DESIGN.md` section 6) |

## Validation benchmark (from `PROJECT.md`)

The app is judged in the first area by this, not by code:

- 50+ providers listed, real searches, some providers got clients → keep going, expand.
- Providers listed but no searches → demand or marketing problem.
- Cannot get 50 free listings → rethink.

Current: 0 real providers (app not released). Seed data only.

## Log

### 2026-11-15 — backend complete, CI green

**Built** (`backend/`): every endpoint in `API.md` — categories, radius search, provider detail and share-code lookup, reviews with rating recalculation, contact-event counting, the provider's own profile and monthly stats, admin approval. Alembic migration for the full schema. Seed script (51 categories, 12 of them top-level; 32 providers around Haret Hreik, 30 verified and 2 pending; 649 reviews). Development login-token script.

**Checked by the coordinating session, not only by the agent that wrote it:**

- `ruff check .` → all checks passed.
- `pytest` → 74 passed.
- GitHub Actions run on the push → success (44 s).
- Live search at Haret Hreik (33.8547, 35.5097), 500 m → 8 providers, all within 470 m, featured one first, then by weighted rating; a provider with 0 reviews last. The order was recomputed by hand from the formula and matches.
- `GET /me/provider` without a token → 401.

**Not yet verified:** token checking against a real Supabase project (JWKS path); needs the Supabase account (founder task F2).

**Decisions made during the build** are recorded in `API.md` under "Details settled during the backend build". One is left for the founder: whether editing a verified profile should send it back to pending.

### 2026-11-15 — project set up

Docs written, local database running, private GitHub repo created. One mistake fixed: the first commit recorded `mobile/` as a nested repository because the Expo setup tool creates its own; the entry was removed.
