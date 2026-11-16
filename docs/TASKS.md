# Haddak — task board

Owners: **main** (the coordinating session), **backend** (backend subagent), **mobile** (mobile subagent), **founder**.
Status: `todo`, `doing`, `done`, `blocked`. Update the status when a task changes; a task is done only when its check passes.

## Setup (main)

| # | Task | Status | Check |
|---|---|---|---|
| S1 | Project docs: PROJECT, V1_SCOPE, SCHEMA, API, TASKS, CLAUDE.md | done | Files exist in `docs/` |
| S2 | Repo skeleton, `.gitignore`, local database via Docker | done | `docker compose up -d db` gives a Postgres with PostGIS |
| S3 | Private GitHub repo `haddak`, first push | done | Repo visible on GitHub |
| S4 | Integrate app with real backend, end-to-end check | todo | Verification list in the plan passes |

## Backend (backend subagent) — works in `backend/` only

| # | Task | Status | Check |
|---|---|---|---|
| B1 | FastAPI project: settings, database session, SQLAlchemy models matching `SCHEMA.md` | done | App starts; `/api/v1/health` returns ok |
| B2 | Alembic initial migration + development seed script | done | Fresh database migrates and seeds without errors |
| B3 | Categories and search endpoints | done | Tests: radius edges, child categories, ranking order |
| B4 | Provider detail, by-slug, contact events | done | Tests: pending profiles are 404 publicly |
| B5 | Token verification, `/me/provider` create, update, stats | done | Tests: 401 without token, 409 on second profile |
| B6 | Reviews: upsert, delete, list, rating recalculation | done | Tests: average updates; cannot review own profile |
| B7 | Admin endpoints with admin key | done | Tests: wrong key is 401; status change makes profile public |
| B8 | Lint (ruff), GitHub Actions workflow for lint + tests, backend README | done | `ruff check` and `pytest` pass locally |
| B9 | Name search (`q`) on the search endpoint | done | Tests: substring match, wildcards escaped |
| B10 | `/health` checks the database | done | Test: 503 when the database is down |
| B11 | Rate limits and contact-event de-duplication | done | Tests: 429, `Retry-After`, repeat tap not stored |
| B12 | Admin approval page at `/admin` | done | Page loads; approve and reject work |
| B13 | Request logging | done | One line per request, no secrets |
| B14 | Dockerfile and deploy notes | done | Image builds and answers `/health` |
| B15 | Refuse to start in production with placeholder secrets | done | Test |

## Mobile (mobile subagent) — works in `mobile/` only

Design comes first and uses the installed design plugins (`impeccable`, `design:*`). No generic template look.

| # | Task | Status | Check |
|---|---|---|---|
| M1 | Expo project (TypeScript, Expo Router), typed API client matching `API.md`, mock data mode | done | App starts in Expo; typecheck passes |
| M2 | Design direction with `impeccable`: `mobile/DESIGN.md` (color, type, spacing, components, right-to-left) | done | Founder chose option B ("Corniche": white ground, sea teal) on 2026-11-15; `DESIGN.md` rewritten for it |
| M3 | Home, Results list, Provider profile built from the design system | done | Search flow works on mock data and on a phone against the backend |
| M4 | **Founder reviews the design direction** | done (B chosen; founder still to confirm Results and Profile on his phone) | Founder approves or asks for changes |
| M5 | Results map view with pins | built, awaiting phone test | Pins match the list; tapping a pin opens the profile |
| M5b | Name search, Get directions, favourites, opening hours and open-now, optional contact count, Suggest a provider | built, awaiting phone test | Each works on a phone against the backend |
| M6 | Sign-in, provider sign-up with pin drop and proof upload, edit, stats | built, awaiting phone and storage test (run `supabase/storage_setup.sql` first) | Works against the backend |
| M7 | Reviews, contact-event logging, share link and QR code | built, awaiting phone test | Events appear in provider stats |
| M8 | English and Arabic strings, right-to-left layout, UX copy pass (`design:ux-copy`) | todo | Switching language flips layout correctly |
| M9 | Design critique, accessibility review, polish pass | todo | Findings fixed or listed |

## Founder

| # | Task | Status |
|---|---|---|
| F1 | Check "Haddak" is free on Google Play, App Store, Instagram, and as a domain | todo |
| F2 | Create a free Supabase project; share the project URL, anon key and JWT settings | todo |
| F3 | Install Expo Go on an Android phone for testing | done |
| F4 | Pick the first area and 3–4 starting categories; list the first 20 providers to approach | todo |
