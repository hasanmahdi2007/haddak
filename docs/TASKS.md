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

## Mobile (mobile subagent) — works in `mobile/` only

Design comes first and uses the installed design plugins (`impeccable`, `design:*`). No generic template look.

| # | Task | Status | Check |
|---|---|---|---|
| M1 | Expo project (TypeScript, Expo Router), typed API client matching `API.md`, mock data mode | todo | App starts in Expo; typecheck passes |
| M2 | Design direction with `impeccable`: `mobile/DESIGN.md` (color, type, spacing, components, right-to-left) | todo | `DESIGN.md` exists and screens use its tokens only |
| M3 | Home, Results list, Provider profile built from the design system | todo | Search flow works on mock data |
| M4 | **Founder reviews the design direction** | todo | Founder approves or asks for changes |
| M5 | Results map view with pins | todo | Pins match the list; tapping a pin opens the profile |
| M6 | Sign-in, provider sign-up with pin drop and proof upload, edit, stats | todo | Works against the backend |
| M7 | Reviews, contact-event logging, share link and QR code | todo | Events appear in provider stats |
| M8 | English and Arabic strings, right-to-left layout, UX copy pass (`design:ux-copy`) | todo | Switching language flips layout correctly |
| M9 | Design critique, accessibility review, polish pass | todo | Findings fixed or listed |

## Founder

| # | Task | Status |
|---|---|---|
| F1 | Check "Haddak" is free on Google Play, App Store, Instagram, and as a domain | todo |
| F2 | Create a free Supabase project; share the project URL, anon key and JWT settings | todo |
| F3 | Install Expo Go on an Android phone for testing | todo |
| F4 | Pick the first area and 3–4 starting categories; list the first 20 providers to approach | todo |
