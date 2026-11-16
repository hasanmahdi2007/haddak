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
| B16 | Structured prices (migration 0005) and search filters `max_price`, `open_now`, `sort` | done | Tests in `test_prices.py` |
| B17 | `places` table with ~80 hand-placed towns and neighbourhoods, fuzzy lookup (migration 0006) | done (coordinates approximate; GeoNames import later) | Tests: recentre, two Jdeideh, unknown place |
| B18 | `POST /assist` with cache, daily limit, monthly budget, `assist_log`; admin `GET /admin/assist/wanted` and Wanted tab | done (real model untested) | Tests in `test_assist.py`, AI client mocked |
| B19 | Assistant phrase test: `evals/assist_phrases.jsonl` (102 phrases) and `scripts/eval_assist.py` | built, not run (needs a key, costs money) | Founder runs it once a key exists |
| B20 | "Did you hire them?": `hire_checks` table (migration 0007), checks on signed-in WhatsApp/Call taps, `GET /me/hire-checks/pending`, `POST /me/hire-checks/{id}`, `hired_through_haddak` on reviews, `confirmed_hires` on profile and stats, admin `no_answer_count_90d` | done | Tests in `test_hire_checks.py` |
| B21 | Real sign-in: Supabase JWKS (ES256/RS256) tokens; HS256 development tokens only with `ALLOW_DEV_TOKENS` | done | Tests in `test_auth_tokens.py` |
| B22 | Stories, banners, follows, sponsor hook (migration 0004); admin sponsor and posts tabs; reports | done | Tests in `test_stories_banners.py`, `test_sponsored.py`, `test_reports.py` |
| B23 | "Available now" (idea 12): `providers.available_until` (migration 0008), `PUT`/`DELETE /me/provider/available` (2, 4 or 8 hours), `available_now` on every provider shape, `available_now` search filter, `open_now` also keeps available providers, urgent words in the assistant | done | Tests in `test_available_now.py`; 449 passed |

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
| M7b | "Did you hire them?" sheet on app open/foreground, "Hired through Haddak" mark on reviews, confirmed hires on profile and in My business | built, awaiting phone test | Sheet shows once per open; answers reach the backend |
| M7c | Sign-up form, stats, reviews, report, share sheet with QR code, story queue between providers | built, awaiting phone test | Works against the backend |
| M7d | Jarak AI assistant screen with keyword fallback (no key needed), price / open-now / sort filters on Results | built, awaiting phone test and a real key | Answers on a phone against the backend |
| M7e | Real sign-in by email link (PKCE callback) | built, awaiting phone test | Link round trip on a phone |
| M7f | "Available now" switch in My business, mint tag on cards and profile, filter pill on Results | built (mock web checked) | Works on a phone against the backend |
| M7g | Poster screen (`app/poster/[slug].tsx`): business and building (natour) variants, English and Arabic side by side; from the share sheet and My business. A4 PDF needs `expo-print` (not installed) | built (mock web checked) | Printed poster scans |
| M7h | Microphone for the assistant (needs a development build) | doing (other session) | Speech reaches the assistant on a phone |
| M8 | English and Arabic strings, right-to-left layout, UX copy pass (`design:ux-copy`) | doing (assistant block moved to the Lebanese tone of the rest on 2026-11-16) | Switching language flips layout correctly |
| M9 | Design critique, accessibility review, polish pass | todo | Findings fixed or listed |

## Founder

| # | Task | Status |
|---|---|---|
| F1 | Check "Haddak" is free on Google Play, App Store, Instagram, and as a domain | todo |
| F2 | Create a free Supabase project; share the project URL, anon key and JWT settings | todo |
| F3 | Install Expo Go on an Android phone for testing | done |
| F4 | Pick the first area and 3–4 starting categories; list the first 20 providers to approach | todo |
| F5 | Create a Claude API key (console.anthropic.com) with a spending limit; put it in `backend/.env` as `ANTHROPIC_API_KEY`; then run `python scripts/eval_assist.py` once (well under $1) | todo |

## Open (not started)

| # | Task | Status |
|---|---|---|
| O1 | Seasonal reminders (idea list) | todo |
| O2 | Email: custom SMTP for sign-in emails on Supabase | todo |
| O3 | Deployment of the backend and database (plan in `SYSTEM_DESIGN.md` section 6) | todo |
| O4 | Play Store listing and first release build | todo |
| O5 | Register the `haddak.app` domain (share links and posters already point at it) | todo |
| O6 | Natour codes for building posters (the poster has an empty box for now) | todo |
