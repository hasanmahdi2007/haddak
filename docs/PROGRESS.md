# Haddak — progress log

What has been built, how it was checked, and what is still open. Newest entry first. The task board with per-task status is `TASKS.md`.

## Where things stand

| Area | State |
|---|---|
| Project docs | Written: PROJECT, V1_SCOPE, SCHEMA, API, SYSTEM_DESIGN, TASKS, this log |
| GitHub | Public repo https://github.com/hasanmahdi2007/haddak; CI (backend, mobile), weekly encrypted backup, uptime check, Dependabot |
| Database | Local: Postgres + PostGIS in Docker, seeded. Production: Supabase (Frankfurt), migrations up to 0019, 143 categories, 3,002 OpenStreetMap listings |
| Backend | All version 1 endpoints plus assistant, claims, account deletion and policy pages (693 tests); production image checked against the live database |
| Mobile app | All version 1 screens built ("Pastel" design: ghost white, alice blue, vanilla and black, Urbanist; English and Arabic), plus sign-in, sign-up, stats, reviews, report, share/QR, stories, Jarak AI, hire checks, "Available now" and the poster. Checked in mock web builds; phone tests pending. Microphone needs a development build (in progress) |
| Hosting | Database live in Frankfurt; API live on Render (`haddak-api.onrender.com`); still to do: Gmail sender and email template, backup secrets, first APK (`DEPLOY.md`) |

## Validation benchmark (from `PROJECT.md`)

The app is judged in the first area by this, not by code:

- 50+ providers listed, real searches, some providers got clients → keep going, expand.
- Providers listed but no searches → demand or marketing problem.
- Cannot get 50 free listings → rethink.

Current: 0 real providers (app not released). Seed data only.

## Log

### 2026-11-25 (night) — Jarak's AI: GPT-6 Luna and Gemini 3.8 Flash

**Why:** the founder judged GPT-6 Luna better than Haiku at English and Arabic, and Gemini 3.8 Flash better than Sonnet and much cheaper.

**What:**
- The model name now picks the provider: `gpt-` → OpenAI, `gemini-` → Google, `claude-` → Anthropic.
- Defaults: `ASSIST_MODEL=gpt-6-luna`, `ASSIST_MODEL_ARABIZI=gemini-3.8-flash`.
- OpenAI request: strict structured output, no reasoning, `store` false.
- Gemini request: JSON against the `AIResult` schema, lowest thinking level.
- Both requests: 6 s timeout, no retry, the same answer checks as before.
- A missing key sends those sentences to the free keyword search.
- Prices are in the cost table. Gemini is costed at its 2027 price so the caps err on the safe side.
- The privacy page names OpenAI, Google and Anthropic.
- The phrase test script works with any of the three.

**Checked:**
- `test_ai_providers.py`: 16 tests with fake clients shaped like the SDK responses (request shape, usage split, refusals, safety stops, cut-off answers, network errors, routing through `/assist`, missing key).
- The existing assistant tests pass with Claude pinned.
- Full suite and the Docker image: see the commit.

**Not checked:** a real request to either API, because there are no keys yet. Gemini's acceptance of our JSON schema in particular is unverified. Until the keys are on Render, Jarak answers with the keyword search.

### 2026-11-25 (evening) — Audit fixes live in production; badge rule after edits

**What:**
- The three audit commits (backend, app, docs) were pushed. GitHub checks passed, Render deployed, and the start-up migrations brought production from 0015 to 0019.
- `storage_setup.sql` was re-run on the live project, so uploads are now capped at 100 photos and 10 proof files per user.
- Supabase "Enforce SSL" was turned on with the CLI; `/api/v1/health` was still ok afterwards.
- Founder decision: a verified profile goes back to `pending` (badge hidden until the founder checks again) when the owner changes the name, category, phone or WhatsApp. Location, photos, description, hours and prices keep the badge. The edit form tells verified owners this before they save.
- Supabase Pro: not planned for now (founder decision); the free plan plus the GitHub backup workflow cover the start.

**Checked:**
- `/api/v1/live` and `/api/v1/health` are ok, so the new version started; that means `sslmode=require` and `SUPABASE_URL` are set on Render.
- `alembic_version` is 0019, and there are 143 categories.
- Listings are intact: 3,002 OSM listings, all `unverified`.
- Live search: 574 listings within 5 km of central Beirut, and "pharmacy" returns 311. Each search took 0.3 to 0.6 s.
- The account-deletion function exists and `haddak_api` can call it.
- `test_me.py` passes: 38 tests, including 10 new ones for the badge rule. `tsc` and `expo lint` are clean.

**Open:**
- Supabase dashboard sign-in settings (F8).
- UptimeRobot.
- The OSM re-import (B32).
- The rest of F9.
- Search misses some Arabizi spellings: "sayadliyye" finds nothing, while the assistant handles such words.

### 2026-11-25 — Price estimates for all jobs; full security, reliability and app audit, fixed

**Why:** the founder asked for estimated prices for every job and region, and for the system to have no known vulnerabilities or weak engineering before real users.
- **Price estimates:** `docs/price-survey/price_estimates_2026-11.csv`, 342 jobs × 5 regions (1,710 rows) from public web research, waiting for the founder's approval row by row (`FAIR_PRICE.md` §6.5). Beirut rows: 9 high confidence (official fuel, gas and generator prices), 31 medium, 302 low; only 26 rows have real regional evidence, the rest use the default regional factors. Not survey data and never shown as such.
- **Audit:** three independent reviews (backend security against OWASP API Top 10, system design and reliability, mobile app against MASVS). Found 0 critical, 6 high, about 23 medium. All code-level findings fixed (task board B33, B34, M11). Key ones: sign-in links could sign a phone into someone else's account (now PKCE code only; `/auth/open` only `haddak://` in production); no limits on public reads; a JWKS hiccup could freeze the API and sign everyone out (now last-good keys, 503); the app gave up during Render's cold start (now warm-up, retries, "Waking up the server"); Android release builds had no Maps key (now from an EAS variable with a fallback); photos could come from any server (now only our Storage, both sides); pool and timeouts unset; backups miss accounts and photos (runbook now says so; role setup committed).
- **Not done, needs the founder:** paid plans (Render Starter, Supabase Pro), dashboard settings, the Maps key, and product decisions (task board F8, F9). Mobile crash reporting (Sentry) skipped: the package added `npm audit` findings and needs an auth token.
- **Checked:** backend `pytest` 856 passed (770 before), `ruff check` and `ruff format --check` clean, one Alembic head (0019), `docker build` OK; mobile `tsc`, `expo lint`, `expo-doctor` 20/20, `npm audit` 0; app flows checked in the web build in mock mode. **Not checked:** anything on a phone (encrypted storage, map fallback, retries against a sleeping server), migrations 0016–0019 on production (not applied).
- **Important before the next deploy:** production now refuses to start without `?sslmode=require` on `DATABASE_URL` and without `SUPABASE_URL` (`DEPLOY.md`).

### 2026-11-21 (evening) — Moved to Frankfurt; API live on Render

**Why:** the Seoul database made every search take about 2.5 s from Lebanon (about seven round trips of 250 ms). With no real users yet, moving was cheap.
- New Supabase project `wamwmhanxqvftrwqlyfh` (`haddak-eu`, Frankfurt) made with the Supabase CLI after the founder paused the Seoul project (the free plan allows two active projects). Same setup as Seoul: extensions, `haddak_api` role with a fresh password (only its SCRAM hash sent), storage buckets and rules, `delete_auth_user`, migrations 0001–0015.
- Data copied from Seoul with a data-only dump; categories and places come from the migrations and were checked identical first (same checksum). 3,002 listings, 196 with phones. All 16 tables owned by `haddak_api`, Row Level Security on, no grants to `anon`/`authenticated`.
- Sign-in settings pushed with `supabase config push`: Site URL and redirect URLs (fixes "localhost:3000"), and **6-digit codes**: new projects default to 8 digits, which the app's code boxes would not have accepted. The email template must wait for custom SMTP (free-plan rule).
- `render.yaml` (Frankfurt, new JWKS URL), `mobile/eas.json` and the local `.env` files point at Frankfurt; `backend/.env.production` now holds the Frankfurt values.
- **Measured:** a full search from Lebanon through the live Render server (Frankfurt, address `haddak-api-ub67.onrender.com` because the plain name was taken) takes 0.35–0.4 s, instead of about 2.5 s with the Seoul database; the server answers its health check in 12 ms. Account deletion tested on the new database with a throwaway sign-in account. The Render service (first deploy) passed every outside check.

### 2026-11-21 — What Google Play and a live service need: account deletion, policies, monitoring

**Why:** Google Play refuses apps with sign-up but no in-app account deletion, and wants a privacy policy link and a web page for deletion. And once real people use it, the founder must hear about crashes and downtime before users do.
- **Delete my account:** `DELETE /api/v1/me` removes the user's reviews (recalculating those providers' ratings), follows, hire checks, claims, and their business profile with everything under it, then their Supabase sign-in account, all in one transaction. The sign-in account is deleted through `haddak_private.delete_auth_user(uuid)` (`supabase/delete_auth_user.sql`): a function that can delete exactly one `auth.users` row and that only `haddak_api` may call, instead of giving the server Supabase's all-powerful secret key. The app's new "Account and privacy" screen (from Following) deletes the user's own photos and proof files in Storage with their session, then calls the API, then signs out; a confirmation sheet comes first.
- **Policies:** `/privacy`, `/terms`, `/delete-account`, Arabic first then English, written from what the code really stores (location never stored, assistant logs without user ids, install id kept only as a hash). Contact address from `CONTACT_EMAIL`. Linked from the app's account screen and sign-in.
- **Operations:** optional Sentry crash reports that strip location, bodies and keys; `nosniff` on every response and HSTS in production; `scripts/smoke_test.py` (health, categories, a real search near Beirut, policy pages, admin locked, docs hidden, HSTS); `.github/workflows/uptime.yml` runs it every 30 minutes once `API_URL` is set; migration 0015 adds indexes for deletion and the two foreign keys the Performance Advisor listed.
- **Measured:** the production image against the live database passed every smoke check except speed: a search from Lebanon took 2.2–3.2 s because each makes about seven round trips to Seoul. From Render Singapore that is about 0.6 s; in Frankfurt it would be well under 0.2 s. Moving to Frankfurt is the most valuable thing left before launch.
- **Checked:** 693 backend tests, ruff, format; `tsc` and ESLint clean; deletion run on the live database as `haddak_api` against a throwaway sign-in account (gone afterwards); migration 0015 applied to production.

### 2026-11-21 — Production database live; ready to deploy

**Why:** the founder wants real users testing as soon as possible, so everything that does not need the founder's own accounts was set up and checked against the real hosted database.
- **Hosted database (Supabase, Postgres 17):** PostGIS and pg_trgm in the `extensions` schema; the backend gets its own login role `haddak_api` (owns the tables, no superuser, no access to Supabase's `auth`/`storage`, 30 s statement timeout, 60 s idle-in-transaction timeout, 20 connections). Its password was made on the laptop and only its SCRAM hash was sent to Supabase; the plain value lives in the git-ignored `backend/.env.production`. All migrations applied through the session pooler.
- **Found by running against the real thing:** the project is in Seoul, not Frankfurt (API placed in Render Singapore; move recommended, see `DEPLOY.md`); the Security Advisor flagged `normalize_name()` (migration 0013, fixed search path); the base categories only ever came from `seed.py`, so the hosted database had 7 of 58 and two without a parent (migration 0014, full tree as reference data); the OpenStreetMap import held a transaction open while waiting minutes for Overpass and made two round trips per shop (now reads first, fetches outside any transaction, writes in one flush).
- **Real listings:** 3,002 OpenStreetMap shops and practices across Lebanon imported as unverified listings (in four regions, because Overpass times out on the whole country at once): Beirut and Mount Lebanon 1,508, South 218, North 159, Bekaa 1,117. Most are pharmacies (848 in the first region alone). **Only 196 have a phone number**, so most cannot be called or messaged until their owner claims them or the founder adds the number; this is the main gap for launch. No sample (seed) providers are in production.
- **Deploy setup:** `render.yaml` (Docker, Singapore, health check, deploys only after checks pass, TRUST_PROXY, generated admin and quota secrets); `mobile/eas.json` (dev client, preview APK and Play bundle against the hosted API); `.github/workflows/backup.yml` (weekly encrypted `pg_dump`, 30 days); mobile CI (type check, lint); backend CI adds formatting and `pip-audit` and tests on Postgres 17; Dependabot; GitHub vulnerability alerts and secret push protection on; `*.env` ignored and the stray empty `backend.env` removed; runbook `docs/DEPLOY.md`.
- **Checked:** the production Docker image was built and run in production mode against the live database (health ok, `/docs` 404, categories, a pharmacy search near Beirut, Jarak's keyword answer); a production dump was encrypted, decrypted and restored into a fresh Postgres 17 with everything intact; migration 0014 left the seeded local database byte-for-byte the same; 679 backend tests, ruff, format, `pip-audit`, `tsc` and ESLint clean.

### 2026-11-21 — Ready for production: AI limits and database lock

**Why:** before deploying, make sure one person or a script cannot run up the Claude bill, and that the database is not readable through Supabase's own API.
- **Jarak's free daily allowance** (`backend/app/services/assist/quota.py`, migration 0011): 15 AI searches a day per phone when signed out, 30 per signed-in account, 100 for everyone on one IP (Alfa and Touch put many phones behind one address). Counted only when the AI is really asked; over it, the free keyword search answers. Kept in the database, so restarts and redeploys no longer reset it (the old per-IP count lived in memory). Stored as a keyed hash of day + who: no IP, account or install id in the table, and days cannot be linked.
- **Spending caps:** new $1 per day (Lebanon time) on top of the $10 per month, so a bad day cannot use up the month.
- **Burst limit:** 20 assistant requests per minute per IP (429).
- **Database lock** (migration 0012): Row Level Security on every table with no policies, and no privileges for Supabase's `anon` and `authenticated` roles, now and for future tables. The backend, as owner, is unaffected.
- **Server:** request bodies over 64 KB get 413 (also when sent in chunks); `/docs` and `/openapi.json` are off in production; production refuses to start without `ASSIST_QUOTA_SECRET`.
- **App:** `src/lib/deviceId.ts` makes a random install id once; sent as `X-Haddak-Device` with Jarak requests only.
- **Checked:** new tests for each rule (allowance per phone, per account, per IP, invented install ids, refused requests not counted, nothing identifying stored, survives restart, next day, daily budget, 429; RLS on every table, privileges revoked, rows hidden even with a stray grant; 413 with and without Content-Length; docs off in production); full backend suite, ruff, `tsc` and ESLint clean.

### 2026-11-17 — "Pastel" theme across the app

**Founder decision:** a soft pastel dashboard look from his reference replaces the purple and tangerine palette; later the same day he removed honeydew (no green except WhatsApp).
- Tokens (`mobile/src/theme/tokens.ts`): ghost-white ground, white cards, alice blue for the Home hero, info panels and done notices, vanilla for Jarak AI, Sponsored, offers and Available now, eerie black for buttons, chosen chips and round arrow buttons; the `mint` token became `trust` (the black Verified pill); `success` (green) removed. Radius: cards 24, insets 16. Softer shadow.
- Type: Urbanist for Latin (loaded in `_layout.tsx`), Beiruti and Readex Pro kept for Arabic; `Txt` picks the set by language or by the words themselves; new `badge` role; text fields use `useTypeScale()`.
- Components: outlined chips that turn black when chosen (distance, filters, hours and day choices), alice-blue List / Map and poster tracks, black Verified pill and map disc, open status as a black dot, category tiles with alice-blue and vanilla wells and a round black arrow, vanilla offer block and claim card, pastel stat tiles in My business, round black send on the Ask entry.
- `mobile/DESIGN.md` rewritten for the theme.
- Verified: `tsc` and `expo lint` clean; no raw colour outside `tokens.ts`; contrast pairs computed (all text AA). Screenshots at 390 x 844 in a mock web build: Home (English, Arabic), Results list and map, profile, Jarak AI results, My business. **Not verified:** on a phone.

### 2026-11-17 — show everyone, OpenStreetMap import, claim your business

**Founder decisions:** search shows unverified listings by default, always after every verified one; listings are imported from OpenStreetMap (ODbL, with attribution); owners can claim a listing or ask for its removal.

- Docs first: `API.md` (`data_source`, nullable phone for OSM listings, claims, `remove_my_business`), `SCHEMA.md` (migration 0010, `claims` table, OSM import and licence rule), `PROJECT.md` decision log.
- Backend: migration 0010; `POST /providers/{id}/claim` (5 per hour per IP), `GET /admin/claims`, approve and reject (approval copies proof and moves an unverified listing to pending); Claims tab in `/admin`. `POST /assist` already searched with unverified included, verified first (unchanged, test kept).
- `scripts/import_osm.py`: one Overpass query for Greater Beirut gave 980 named places in 23 categories (537 pharmacies). Only 63 had a phone and 64 readable hours. Imported into the dev database; a second run updated the same 980 rows.
- App: "Verified only" starts off; a "Not verified yet: Haddak hasn't checked these" divider above the first unverified result; claim card (tangerine wash) and claim sheet with optional proof; "Data © OpenStreetMap contributors"; no WhatsApp/Call when there is no number. Mock mode has one OSM listing and accepts claims.
- Checked: 647 backend tests, ruff clean, `tsc --noEmit` and `expo lint` clean. Not checked on a phone.

### 2026-11-15 (evening) — unverified listings, Supabase project, AI verifier plan

**Founder decisions:**

- A provider can be listed without being verified. Search shows verified only by default; a switch "Include unverified" adds the rest, always ranked below verified. Proof is optional at sign-up; no proof means not verified.
- A suggestion from another person does not publish itself: the founder publishes it from the admin page as an unverified, unclaimed listing (privacy and abuse reasons). The founder accepted this.
- Verification stays a human decision for now. An AI verification assistant (Claude Opus 5.5 with vision and tools: place lookup, web search, duplicate checks) comes after sign-up and proof upload exist. It starts in shadow mode (AI verdict recorded next to the founder's decision) and only auto-approves kinds of proof where it agreed with him over 50 to 100 cases.
- Order of work: finish these features, then deployment, then AI search and the AI verifier.

**Built, backend** (commit `9cefc86`, migration `0003_unverified_listings_reports`): statuses `unverified`, `pending`, `verified`, `rejected`; `include_unverified` on search; public `verified` and `claimed` flags; admin "decline proof" and "restore"; `POST /admin/suggestions/{id}/publish`; provider reports (public create, admin list and delete); admin page tabs for these.

**Checked by the coordinating session:** `ruff check .` clean; `pytest` → 244 passed (was 161); migration applied to the dev database; live search at Haret Hreik, 1 km: 15 verified-only, 17 with the switch on, the 2 extra flagged `verified: false`.

**Not done / not verified:** the agent was cut off by a session restart before finishing. The seed script still creates only 2 non-verified samples (both `pending`, none from a suggestion); `backend/README.md` is not updated for the new statuses; the new admin page tabs were not opened in a browser; publish-from-suggestion and reports were not tried live (tests only).

**Supabase:** the founder created the hosted project (ref `ginifqwdlqkbsptiahun`, URL `https://ginifqwdlqkbsptiahun.supabase.co`). Its public URL and publishable key are in `mobile/.env` (git-ignored). Its login service signs tokens with ES256, which the backend's JWKS path supports. A Supabase MCP connector is configured in `.mcp.json`; ask the founder before changing anything in the hosted project. Nothing has been created in it yet (no tables, buckets or PostGIS). A local Supabase stack (`supabase/config.toml`) was being set up for development; whether its Docker images finished downloading is unknown.

**Next, in order:**

1. App: "Include unverified" switch on Results, "Not verified" and "Listed by the community" labels, Report action on the profile.
2. Sign-in with an email code (Supabase Auth), then provider sign-up (form, pin drop, proof photo, hours, contact-count switch).
3. Reviews, provider stats screen, share link and QR code.
4. Deployment (Supabase hosted database, API host, Play Store).
5. AI search and the AI verification assistant.

**Local servers are not permanent:** the backend (`uvicorn app.main:app --host 0.0.0.0`) and the Expo server stop when the Claude Code session that started them ends. Restart both before testing on the phone.


### 2026-11-15 — app screens for favourites, hours, contact count and suggestions

**Built** (`mobile/`): favourites stored on the phone (heart on the profile, Saved screen, count on Home); "Open now" / "Closed" on result cards and the map card; an "Opening hours" section on the profile; the optional "N people contacted this month" line; the "Suggest a provider" form, reached from Home and from an empty results list. Commits `531abfe`, `182dd1e`.

**Fixed by the coordinating session:**

- The suggestion form rejected local numbers such as `70 123 456`; it now adds `+961` to 7- or 8-digit local numbers.
- On a scrolled profile the back, heart and share buttons sat on top of the text; a solid bar now fades in behind them once the photo has scrolled away.

**Checked by the coordinating session:** `npx tsc --noEmit` and `npx expo lint` → no errors after each change; opened the Saved, opening-hours and suggestion-form screenshots.

**Not verified:** all of this on a phone (keyboard over the form, favourites surviving an app restart, the fading bar, Arabic wording); hours, contact count and suggestions against the real backend from the app (agents tested with mock data; the backend endpoints themselves were tried live); the two fixes above in a running app.

**Remaining for version 1:** sign-in, provider sign-up (pin drop, proof upload, hours, contact-count switch), reviews, provider stats screen, share link and QR code. These need the Supabase project (founder task F2). Then deployment, then AI search.

### 2026-11-15 — extra features: name search, directions, hours, contact count, suggestions

**Founder decisions:** add name search, "Get directions", working hours with "open now", favourites, "Suggest a provider" and a provider stats screen to version 1; the public contact count is optional per provider (hidden by default; counting itself is always on); finish these before starting AI search. Hosting stays Supabase plus a small container host; the reasoning and a scale estimate are in `SYSTEM_DESIGN.md` section 7.1.

**Built, mobile:** search-by-name field on Home (uses the backend's `q`), "Get directions" on the profile (opens Google Maps; no API cost). Commit `2bbc68e`.

**Built, backend:** `providers.show_contact_count` and public `contacts_this_month`; `providers.opening_hours` with a computed `open_now` (Asia/Beirut) in detail and search results; `provider_suggestions` table with public `POST /suggestions` (5 per hour per IP) and admin list/delete, plus a Suggestions tab on the admin page. Migration `0002_contact_count_hours_suggestions`. Contract written into `API.md` and `SCHEMA.md` first.

**Checked by the coordinating session:**

- Mobile: `npx tsc --noEmit` and `npx expo lint` → no errors; name search for "ali" against the real backend returns matches (it matches anywhere in the name, so "Khalil" is included).
- Backend: `ruff check .` → clean; `pytest` → 161 passed (was 103).
- Backend restarted and tried live: search results carry `open_now` (a studio with no Sunday hours shows closed on a Sunday, a provider with no hours shows null); provider detail returns `opening_hours` and `contacts_this_month`; `POST /suggestions` → 201; admin list shows it; delete → 204; admin list without the key → 401.

**Not verified:** the admin page's Suggestions tab in a browser; the Docker image build with the new `tzdata` dependency; the two mobile features on a phone (Arabic wording, keyboard, dark mode).

**Still to build in the app:** favourites (in progress), screens for hours / contact count / suggestions, then sign-in, provider sign-up, reviews, stats, share link and QR (need the Supabase project).

### 2026-11-15 — map view built (not yet tested on a phone)

**Built** (`mobile/`): `react-native-maps` 1.29.11; the Results map shows the search position, a translucent teal radius circle, one pin per provider from the same results as the list (featured pins have an amber edge), and a docked card for the selected pin that opens the profile. A web fallback keeps the web build working for screenshots. No Google Maps API key is needed in Expo Go; a store build will need one.

**Checked by the coordinating session:** `npx tsc --noEmit` and `npx expo lint` → no errors. Opened the web fallback screenshot (`design-preview/results-map-en.png`): 13 pins inside the 1 km circle, selected featured pin, docked card.

**Not verified:** the real map. It only runs on a phone, so rendering, pin taps, zoom fit and dark mode are untested until the founder tries it in Expo Go.

**Also today:** the local backend had stopped and the app showed "Couldn't load categories"; restarted with `uvicorn app.main:app --host 0.0.0.0`.

### 2026-11-15 — design chosen (option B) and applied to all three screens

**Decision:** from three Home screen options (A warm, B teal, C multi-colour) the founder chose **B, "Corniche"**: white ground, sea teal `#00708A` primary, pale aqua surfaces, one coral accent.

**Built** (`mobile/`): B is the only design in the code (options A and C and the switching code removed). Results and Provider profile restyled to match Home. Colour tokens renamed from the old concept names to plain roles (`background`, `surface`, `primary`, `rating`, `success`, `danger`...). Dark mode restored. `mobile/DESIGN.md` rewritten for B. 15 new screenshots in `mobile/design-preview/` replace the old ones.

**Checked by the coordinating session:**

- `npx tsc --noEmit` and `npx expo lint` → no errors.
- Opened the Results (light), Provider profile (light) and Results (Arabic, dark) screenshots: real content, no placeholders, layout mirrored correctly in Arabic.

**Reported by the agent, not re-checked:** the other 12 screenshots; the accessibility audit (code and contrast calculation only, not a TalkBack test) and its fixes.

**Not verified:** the restyled screens on a real phone (web build only so far); large system font sizes; screen-reader order.

**Known small issues:** a long price wraps awkwardly on a results card; the photo gallery swipes left-to-right in Arabic; the WhatsApp button uses a generic chat icon; `app.json` still has the old navy as the Android icon background; tile and card edges are faint (about 1.3:1) by design.

**Cost note:** this agent was cut off once by the usage limit and ended at about 260k tokens of context. Later phases are split into smaller jobs, one fresh agent each.

### 2026-11-15 — mobile phase 1 runs on a phone; design direction rejected

**Built** (`mobile/`): Expo project, theme tokens, 12 components, and the Home, Results and Provider profile screens, with a real API client and built-in mock data (used when `EXPO_PUBLIC_API_URL` is unset). Commit `3c768ae`.

**Checked by the coordinating session:**

- `npx tsc --noEmit` and `npx expo lint` → no errors.
- The founder opened the app on his Android phone through Expo Go (`exp://<computer-ip>:8081`, backend on the same Wi-Fi). Categories, providers, profiles and reviews loaded from the real backend.

**Found and fixed:** sample phone numbers in the seed script and the mock data looked like valid Lebanese mobile numbers (`+96170…`), so a tap on WhatsApp or Call could have reached a stranger. All sample numbers are now `+9610000xxxx`, which cannot be dialled (Lebanese numbers never start with 0 after `+961`). The local database was re-seeded: 32 of 32 providers have the safe numbers.

**Founder decision:** the first visual direction ("stamped paperwork": navy header, beige ground, beige tiles) is rejected as dull. He wants a bright, light theme with a livelier palette and a better Home layout. A fresh agent is producing three Home screen options in `mobile/design-preview/options/` for him to choose from. `mobile/DESIGN.md` will be rewritten after the choice.

**Known weakness:** the first agent's screenshots in `mobile/design-preview/` were mostly captured before data loaded and show placeholders; they are not a reliable record of the design.

**Process change:** agents now use the Graphify code graph to find code, and each phase gets a fresh agent instead of resuming one with a very large context.

### 2026-11-15 — backend hardened and ready to deploy

**Built** (`backend/`): search by name (`q`), `/health` that checks the database, rate limits and contact-tap de-duplication (`app/rate_limit.py`), an approval page at `/admin` (`app/static/admin.html`), one log line per request without query strings or headers, a `Dockerfile`, and a startup check that refuses to run in production with placeholder secrets.

**Checked by the coordinating session:**

- `ruff check .` → all checks passed. `pytest` → 103 passed.
- Admin page opened in Chrome against the local API: unlocked with the development key, listed the 2 pending sample profiles with proof, photo and map links, "Approve" moved one to verified with the message "Approved Zen Yoga Studio.", no console errors. The sample profile was then set back to pending.
- Found and fixed in review: the client IP was read from the first entry of `X-Forwarded-For`, which a client can write itself to get a fresh rate-limit allowance. It is now read `PROXY_HOPS` entries from the right, with a test that proves a faked entry does not help.

**Reported by the backend agent, not re-run by the coordinator:** the Docker image builds, runs as a non-root user, answers `/health` against the local database, and refuses to start with a placeholder admin key.

**Not yet verified:** a real hosting platform (including the right `PROXY_HOPS` value there), and Supabase token checking.

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

## 2026-11-16 (night)

**Full app redesign (third direction: mint, lavender, ink).** The founder rejected the teal design and asked for the whole layout to change, not only colours.
- Home, Results and Profile rebuilt: borderless rounded colour blocks, pill controls, ink primary buttons. `mobile/DESIGN.md` rewritten.
- Home no longer has a bottom dock; tapping a category searches straight away with the chosen radius.
- Radius control is a compact 36 dp pill row. Results has a "Verified only" filter (uses `include_unverified`) and a labelled List / Map switch.
- Map pins carry the provider's name; verified and unverified pins differ.
- Sponsored card variant on Results.
- Verified: `tsc` and `expo lint` clean, web screenshots in `mobile/design-preview/`. **Not verified on a phone** (native map especially).

**Backend: stories, banners, follows, sponsored hook (migration 0004).**
- Stories: text + optional image URL, 24 hours, max 5 active, verified owners only.
- Banners: one per provider, 1 to 7 days, optional discount percent.
- Follows: signed-in user follows a provider; `/me/following`, `/me/feed`; `follower_count` and `is_following` on the profile.
- Sponsored: shown name for the existing `featured_until`, plus owner-written `sponsor_hook` (80 chars). The admin switches it on; no in-app payment.
- Seed now has 6 unverified providers, 4 sponsored, 8 stories, 3 banners.
- Verified: 322 tests pass, ruff clean, dev DB migrated and seeded.
- Not done: admin page buttons to delete a story or banner (endpoints exist).

## 2026-11-16 (day)

**Design follow-ups from the founder.** Light-only theme (dark mode switched off on request), no black fills; all category tiles one colour (white) on a soft lavender ground; purple primary buttons, mint kept for trust marks.

**Stories, banners, sponsored: app read side.** "Updates nearby" row on Home, full-screen story viewer, story ring on cards and profile, offer block on profile, "Sponsored" section (max 2, labelled paid placement) at the top of category results, follower count on profile.

**Sign-in, Follow, Following, My business.**
- Sign-in with Supabase email + 6-digit code (`src/app/sign-in.tsx`, `src/lib/auth.ts`, `src/lib/supabase.ts`); the app sends the access token to the backend; a 401 signs out locally.
- Follow / unfollow on the profile (optimistic). Following screen: account, stories feed from followed providers, followed list.
- My business: post and delete updates (max 5, 24 h), offer with optional discount (1 to 7 days), sponsor sentence. Not-verified and no-listing states.
- Dev-only `EXPO_PUBLIC_DEV_TOKEN` lets the local app act as a signed-in user with a token from `backend/scripts/dev_token.py` (works only while `SUPABASE_JWKS_URL` is empty).
- Verified: `tsc` and `expo lint` clean; follow, feed, stories, offer and sponsor sentence exercised against the local backend with curl and the web build; sign-in error states with Supabase calls stubbed. No real email sent.
- **Not verified:** real email sign-in (needs Supabase dashboard setup: `{{ .Token }}` in the Magic Link and Confirm signup templates, custom SMTP, backend `SUPABASE_JWKS_URL` for the hosted project); anything on a phone.

**Next:** provider sign-up from the app (form, pin drop, proof photo), Supabase dashboard setup for sign-in, phone test of everything above.

**Provider sign-up, edit listing and stats in the app.**
- "List your business" (`mobile/src/app/join.tsx`): category, name, description, price, phone and WhatsApp (local Lebanese numbers get +961), area, a map pin (phone position, else central Beirut; drag or tap; web shows a stand-in), opening hours per day, the show-contact-count switch, up to 5 photos and an optional proof photo. Sends `POST /me/provider`; the result screen says the listing is live without the badge and what happens to the proof. Reached from My business (no listing) and a text link at the bottom of Home (sign-in first).
- "Edit listing" (`business-edit.tsx`) reuses the same form (`components/ProviderForm.tsx`) and sends only changed fields with `PATCH /me/provider`. Unverified owners get a "Send proof" button.
- My business shows this month's views, WhatsApp taps and calls (`GET /me/provider/stats`) plus followers, as four plain tiles.
- Uploads (`mobile/src/lib/upload.ts`): resized to 1600 px, JPEG 0.8, straight to Supabase Storage under `<user id>/`; photos as public URLs, proof as a one-year signed URL. Mock mode returns placeholder links; a build without Supabase says uploads are not set up.
- `supabase/storage_setup.sql` creates the two buckets and the owner-folder rules. **Not run on the hosted project yet.**
- Mock mode can create and edit a listing (`api/mockOwner.ts`) after `__haddakMock.setOwnProvider('none')`.
- Verified: `tsc` clean, `expo lint` clean apart from one existing-file warning; base64 decoding checked against Node. **Not verified:** a real upload, the SQL on Supabase, the native map pin and image picker on a phone, create/edit against the real backend.

**Profile: reviews, report, share and QR, stories that continue.**
- Reviews card (`components/ProviderReviews.tsx`): average, stars and count; the latest three, "See all" then pages of 10; my own review in a white block with Edit and Delete (asks once). "Write a review" opens a sheet (`ReviewSheet.tsx`): five stars in 48 dp targets, name, optional comment; signed out it opens sign-in first. The profile refetches the average after every write.
- Backend: new `GET /providers/{id}/reviews/mine` (my review or `null`), so a returning reviewer edits instead of starting over. Owners were already blocked from reviewing their own listing (403); a test for delete was added.
- "Report this listing": a quiet line at the end of the profile; the sheet (`ReportSheet.tsx`) has the five reasons, optional details and a thank-you.
- Share: the profile's share button opens a sheet with `components/ShareProfile.tsx` (props `slug`, `name`): QR code of `https://haddak.app/p/<slug>`, dark on pure white with a quiet zone, and a Share button. `haddak://p/<slug>` opens the profile (`app/p/[slug].tsx`).
- Story viewer: opened from a stories row it goes on to the next provider and back to the previous one (`lib/storyQueue.ts`); from a profile it plays one provider as before.
- Mock mode supports writing, editing and deleting a review (the average follows) and reporting.
- Verified: backend `pytest` 328 passed, `ruff` clean; `tsc` clean in these files; web build in mock mode with a development token at 390 x 844: write, post and delete a review, report and thank-you, share sheet with QR, `/p/<slug>` redirect, the story viewer moving from Hadi Mobile Clinic to Ali Tech and back, and the review sheet in Arabic. **Not verified:** on a phone (sheet and keyboard on Android, the share dialog, scanning the printed QR code), against the real backend.

**2026-11-16 · Assistant in the app (mock mode).** "Ask Haddak" entry and example sentences on Home (search by name moved behind a link), new `app/assist.tsx` for every answer kind (results with top three cards, WhatsApp draft and Call, read aloud; clarify; place choice; place not found; widened; nobody found; emergency with built-in numbers in `lib/emergency.ts`; off topic; unavailable falls back to a name search), `POST /assist` types and client, price/open/sort filters on Results, a keyword-rule fake assistant in `api/mockAssist.ts` and structured prices in mock data; verified with `tsc`, `expo lint` and a web walk-through of every kind in English and Arabic at 390 x 844. Not verified: the real backend, a phone, speech output, the keyboard microphone.

**2026-11-16 · Assistant backend, structured prices and places.** Migration 0005 adds `providers.price_amount`, `price_unit`, `price_currency` (in every provider shape, `POST`/`PATCH /me/provider` and admin `PATCH`); search gains `max_price` + `price_unit` + `price_currency`, `open_now` (Beirut time, same rule as the profile) and `sort` (`best`, `distance`, `price`). Migration 0006 adds `pg_trgm`, `normalize_name()`, the `places` table with about 80 approximate centres (cities and Beirut neighbourhoods, Arabic names and common spellings), `assist_cache` and `assist_log`. New `POST /assist` (exact-match skip, cache, daily limit, monthly budget, structured output through the `anthropic` SDK, answer checks, place recentre, place options, unknown place, widening, template summary in English and Arabic, the `understood` form with a slug-only place), `GET /admin/assist/wanted` and a Wanted tab on the admin page. Seed: 31 providers with structured prices, two new tutors (one at $30/hour, one at $25/hour). Phrase test prepared (`evals/assist_phrases.jsonl`, `scripts/eval_assist.py`). Verified: `pytest` 392 passed (AI client mocked, no network), `ruff check` clean, migration up/down/up on the test database, migrate and seed on the dev database, `eval_assist.py --check` and its no-key refusal. **Not verified:** the real model (no key; the phrase test costs money and was not run), prompt caching in practice, the place coordinates.

**2026-11-16 · Real sign-in by email link (hosted Supabase).** The hosted project's default email holds a sign-in link, not a code, so the app now uses the PKCE flow: `signInWithOtp` passes `emailRedirectTo: Linking.createURL('auth-callback')` (`exp://<ip>:8081/--/auth-callback` in Expo Go, `haddak://auth-callback` in a build); new route `app/auth-callback.tsx` trades the `code` for a session (also handles tokens in the `#fragment` and `error_description`), closes, and the sign-in screen underneath then closes and finishes the waiting action. Typed 6-digit codes still work. Backend: the token header's `alg` picks the check: ES256/RS256 via `SUPABASE_JWKS_URL`, HS256 development tokens only with the new `ALLOW_DEV_TOKENS=true` (production refuses to start with it, and now also requires `SUPABASE_JWKS_URL`), `alg: none` refused. Local `backend/.env` points at the hosted project's JWKS (one ES256 key, checked with curl) with development tokens on. Verified: `pytest` all passed (new `tests/test_auth_tokens.py` with a locally generated EC key), `ruff` clean, mobile `tsc` and `expo lint` clean. **Not verified:** the link round trip on a phone.

**2026-11-16 · "Did you hire them?" (idea 6).** Backend: migration 0007 adds `hire_checks`; a signed-in WhatsApp/Call contact event creates one (at most one per user and provider in 7 days, never on your own listing); `GET /me/hire-checks/pending` (12 h to 14 days, newest first, max 3) and `POST /me/hire-checks/{id}` (owner only, once, shared write rate limit); reviews carry `hired_through_haddak`; ProviderDetail, OwnProvider and owner stats carry `confirmed_hires` (90 days); the admin provider list carries `no_answer_count_90d`, shown on admin cards. Search ranking unchanged. Mobile: `HireCheckPrompt` in the root layout asks once per app open/foreground through the shared Sheet (Yes / Not yet / They didn't answer, then Rate them / Later opening ReviewSheet); "Hired through Haddak" pill on reviews; "N confirmed hires" in the profile's rating block; confirmed hires in My business stats; mock mode seeds one pending check. English and Arabic copy.
**Checked:** `pytest` 435 passed (417 before + 18 new in `test_hire_checks.py`), `ruff check` clean, dev DB migrated to 0007; `npx tsc --noEmit` and `npx expo lint` clean; mock web screenshots of the sheet in English and Arabic. **Not checked:** on a phone, or against the real backend from the app.

**2026-11-16 · "Available now", posters, Arabic tone, design doc.** Backend: migration 0008 adds `providers.available_until`; `PUT /me/provider/available {hours: 2|4|8}` and `DELETE /me/provider/available`; `available_now` on every provider shape and `available_until` on OwnProvider; search gains `available_now`, and `open_now` now also keeps providers marked available; the assistant's keyword fallback reads urgent words ("urgent", "ضروري", "عاجل", "darouri") as open now and the AI prompt says the same. Docs first (API, SCHEMA, AI_ASSISTANT). Mobile: "Available now" block in My business (switch, 2/4/8 hours, "On until 3:13 AM"), mint `AvailableTag` with a lightning icon on cards, assistant cards and the profile, an always-there "Available now" pill on Results; poster screen `app/poster/[slug].tsx` (business and building/natour variants, English and Arabic side by side, dark on white, big QR code, Share link, Print on web) opened from the share sheet and My business. A real A4 PDF needs `expo-print`, which is not installed. Arabic: the assistant and price strings rewritten in the app's Lebanese tone (keys unchanged). `mobile/DESIGN.md` colour table now matches `tokens.ts`; new components documented.
**Checked:** `pytest` 449 passed (435 before), `ruff check` and `ruff format --check` clean, dev DB migrated to 0008; `npx tsc --noEmit` and `npx expo lint` clean; mock web screenshots at 390 px of both posters and the My business switch off and on. **Not checked:** on a phone, against the real backend from the app, scanning a printed poster.
