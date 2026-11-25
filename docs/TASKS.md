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
| B24 | OpenStreetMap import (`scripts/import_osm.py`, mapper in `app/services/osm_import.py`): `source = 'osm'`, `osm_ref`, nullable phone for OSM rows (migration 0010), `data_source` on provider shapes, `remove_my_business` report reason | done; Greater Beirut imported into the dev DB (980 listings) | Tests in `test_osm_import.py` (sample JSON, no network) |
| B25 | Claims: `claims` table (migration 0010), `POST /providers/{id}/claim`, admin `GET /admin/claims`, approve, reject; Claims tab in the admin page | done | Tests in `test_claims.py`; 647 passed |
| B26 | Production hardening: free daily AI allowance per account/phone and per IP in the database (`assist_quota`, migration 0011, `quota.py`), $1 daily spending cap, 20 assistant requests per minute per IP; tables closed to Supabase's Data API (migration 0012); 64 KB request body limit; API docs off in production; `ASSIST_QUOTA_SECRET` required in production. App sends a random install id with Jarak requests. | done | `test_assist.py` (allowance section), `test_db_security.py`, `test_request_limits.py`, `test_hardening.py` |
| B27 | Production database live on Supabase: extensions in `extensions`, own login role `haddak_api` with timeouts, migrations 0001–0014 applied (0013 fixed function search path, 0014 full category tree), OpenStreetMap listings for all of Lebanon imported, Security Advisor clean. Render blueprint (`render.yaml`), EAS build profiles (`mobile/eas.json`), encrypted weekly backup workflow, mobile CI, formatting and dependency audit in backend CI, Dependabot, runbook `docs/DEPLOY.md`. | done | `test_db_security.py`, `test_categories_migration.py`; production image run against the live database |
| B29 | Launch requirements and operations: `DELETE /me` (everything about a user, sign-in account through `haddak_private.delete_auth_user`), "Account and privacy" screen in the app (policy links, delete with confirmation, deletes the user's Storage files first), `/privacy`, `/terms`, `/delete-account` pages (Arabic and English), Sentry crash reports (optional, scrubbed), security headers (nosniff, HSTS), `scripts/smoke_test.py`, uptime workflow, migration 0015 (indexes) | done | `test_account_deletion.py`, `test_legal_and_ops.py`; 693 passed; deletion tested on the live database with a throwaway sign-in account; production image smoke-tested against the live database |
| B30 | Move to Frankfurt: new Supabase project `wamwmhanxqvftrwqlyfh`, same setup, data copied, sign-in settings pushed (6-digit codes, Site URL, redirect URLs), Render region Frankfurt, app and docs switched | done | Search 0.8 s from Lebanon instead of 2.5 s; deletion tested on the new database |
| B31 | Scope widening (2026-11-24): text search `q` across business names, category names and aliases (Arabic, English, Arabizi, typos via trigram similarity) and area names (migration 0016); paging 20 at a time (`limit`/`offset`, "Showing 20 of N"); category tree v2, 58 → 143 categories with aliases (migration 0017, same tree in `scripts/seed.py`) | done; in production 2026-11-25 (migrations up to 0019 applied by the deploy; 143 categories live, search checked) | Tests for text search, paging and `test_categories_migration.py` pass |
| B32 | OpenStreetMap re-import with the v2 mapping (new shop, food and service tags; phone/computer/electronics remap): local database first, then production | doing | Local import checked by eye on the map; then production import, claimed rows untouched |
| B33 | Security audit fixes (2026-11-25): read limits on public endpoints, `/auth/open` only `haddak://auth-callback` in production and forwards only code/error, JWKS last-good keys + 503 instead of 401 + `iss`/leeway/anonymous checks, Sentry without local variables, photo/story/proof URLs only from our Storage (`SUPABASE_URL`), contact dedup in the database (migration 0018) and public count = signed-in taps once per user per day, per-user limit keys and IPv6 /64, storage per-user caps, production refuses `CORS *` / missing `sslmode` / missing `SUPABASE_URL`, bounded `offset` and ids, admin list paged and batched, row locks on PATCH | done | `test_security_fixes.py`, `test_auth_tokens.py`; 856 passed |
| B34 | Reliability audit fixes (2026-11-25): `/api/v1/live` health check, `RUN_MIGRATIONS` switch, explicit pool and timeouts with 8 s statement timeout, JSON 503/500 errors, AI 6 s budget with one shared client and 8 concurrent calls, account deletion refuses in production without the auth function, `assist_log` writes best-effort, `scripts/retention.py` and `contact_event_months` roll-up, `X-Request-ID`, `count(*) OVER ()`, category cache, trigram and `stories(expires_at)` indexes (migration 0019), migration lock and timeouts, `supabase/role_setup.sql`, rebuild runbook, CI permissions + docker build + non-superuser migration run, `scripts/load_test.py` | done | `test_reliability.py`; 856 passed |
| B28 | Founder: Render account + deploy, Gmail SMTP + email template + Supabase URLs, backup secrets on GitHub, Expo account + first APK (`docs/DEPLOY.md`, steps 1–4, plus `CONTACT_EMAIL`, optional `SENTRY_DSN`, and the `API_URL` repository variable for the uptime check) | todo | |

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
| M7h | Voice in Jarak: microphone through `expo-speech-recognition` (tries `ar-LB`, then `ar`), answers read aloud through `expo-speech`. Hidden in Expo Go, because speech recognition needs native code | built, awaiting the EAS preview build (founder task F6) | On the preview build: speak a request in Lebanese Arabic, it reaches Jarak, the answer is read aloud |
| M7i | Show everyone by default ("Verified only" off), "Not verified yet" divider in Results; claim card and sheet on unclaimed profiles; OSM attribution; no WhatsApp/Call without a number | built (tsc and lint clean), awaiting phone test | Claim reaches the admin page; approved listing shows in My business |
| M8 | English and Arabic strings, right-to-left layout, UX copy pass (`design:ux-copy`) | doing (assistant block moved to the Lebanese tone of the rest on 2026-11-16) | Switching language flips layout correctly |
| M9 | Design critique, accessibility review, polish pass | todo | Findings fixed or listed |
| M10 | Scope widening (2026-11-24): search bar first on Home (names, kinds of business, areas), "All categories" screen for the 143-category tree with instant filtering on `aliases`, Results paging 20 at a time with "Showing 20 of N", map pins clustered, "wider radius" offer instead of an empty screen | doing | Works on a phone against the backend with the v2 tree |
| M11 | Audit fixes (2026-11-25): sign-in links accept only the PKCE code (no tokens), cold-start warm-up and GET retries with "Waking up the server", 30 s for Jarak, create-profile checks `GET /me/provider` after a timeout or 409, request timer covers the token, ErrorBoundary, encrypted session storage and `allowBackup: false`, images only from our Storage, structured price in the form, release builds refuse mock mode, Maps key from `GOOGLE_MAPS_ANDROID_API_KEY` with a fallback, one-at-a-time photo uploads, blocked permissions, double-submit guards, Following paged 20, location explanation card | built (tsc, lint, expo-doctor clean; no automated tests, no phone test yet) | Phone test on a preview build |

## Founder

| # | Task | Status |
|---|---|---|
| F1 | Check "Haddak" is free on Google Play, App Store, Instagram, and as a domain | todo |
| F2 | Create a free Supabase project; share the project URL, anon key and JWT settings | todo |
| F3 | Install Expo Go on an Android phone for testing | done |
| F4 | Pick the first area and 3–4 starting categories; list the first 20 providers to approach | todo |
| F5 | Create a Claude API key (console.anthropic.com) with a spending limit; put it in `backend/.env` as `ANTHROPIC_API_KEY`; then run `python scripts/eval_assist.py` once (well under $1) | todo |
| F6 | Make the EAS preview build to see and test voice in Jarak (M7h): in `mobile/`, run `npx -y eas-cli build -p android --profile preview`, install the APK, test the microphone and read-aloud | todo |
| F7 | Approve or reject the price estimates in `docs/price-survey/price_estimates_2026-11.csv` (`approved` column) | todo |
| F8 | Launch settings from the 2026-11-25 audit (`DEPLOY.md`). Done 2026-11-25: `sslmode=require` and `SUPABASE_URL` on Render (new version started), `storage_setup.sql` re-run (upload caps live), Google Play account paid. Left: Supabase dashboard (Enforce SSL; remove `exp://**`/`haddak://**`/LAN redirect URLs; Confirm email on; password and anonymous sign-ins off; OTP length 6); Google Maps Android key as EAS env var; UptimeRobot on `/api/v1/health` (remind the founder at the end); Render Starter before any tester. Supabase Pro: not planned (founder decision 2026-11-25: free plan until real traction; backups come from the GitHub backup workflow) | doing |
| F9 | Decided 2026-11-25: a verified profile goes back to `pending` when the owner changes name, category, phone or WhatsApp (built, `test_me.py`); location and other edits keep the badge. Still to decide: claimed imported listing when its owner deletes the account (delete or release); minimum account age before reviewing; retention windows (stories 30 d, assist log 180 d, raw contact events ~3 months) | todo |

## Fair price ("Is this price fair?", spec in `FAIR_PRICE.md`)

| # | Task | Owner | Status | Check |
|---|---|---|---|---|
| P0 | Founder survey, waves 1–5 (~42 jobs × 5 regions × 5 businesses), in a private copy of `docs/price-survey/price_survey_template.csv`; about four weekends (`FAIR_PRICE.md` section 6). **Can start now**, no code needed | founder | todo | Each wave-1 job has 5+ prices in each region, or is marked thin |
| P1 | Show survey and business prices: `price_jobs`, `price_survey` and import script, `places.region`, summary endpoint, "Usual prices here" in the app, owner price level at claim and in My business, official generator tariff card and MOPH link on pharmacy pages (ideas 21, 22). `SCHEMA.md` and `API.md` first | backend, mobile | todo | Tests for medians, minimum count, window and regions; RLS on every new table |
| P2 | "How much did you pay?" after "Yes, I hired them" (`price_reports`), "Customers say", "The price didn't match" report with owner notice (`price_mismatch_reports`), admin list of flagged answers; `DELETE /me` covers the new tables | backend, mobile | todo | Tests: only hired users answer, one answer each, hard limits, 3 reporters in 90 days |
| P3 | "Fair price" badge and its ranking boost, Jarak `price_check` answers, public price pages | backend, mobile | todo | Badge rules tested; Jarak never gives a number the database did not |

## Open (not started)

| # | Task | Status |
|---|---|---|
| O1 | Seasonal reminders (idea list) | todo |
| O2 | Email: custom SMTP for sign-in emails on Supabase | todo |
| O3 | Deployment of the backend and database (plan in `SYSTEM_DESIGN.md` section 6) | todo |
| O4 | Play Store listing and first release build | todo |
| O5 | Register the `haddak.app` domain (share links and posters already point at it) | todo |
| O6 | Natour codes for building posters (the poster has an empty box for now) | todo |
