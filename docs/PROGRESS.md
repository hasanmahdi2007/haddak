# Haddak — progress log

What has been built, how it was checked, and what is still open. Newest entry first. The task board with per-task status is `TASKS.md`.

## Where things stand

| Area | State |
|---|---|
| Project docs | Written: PROJECT, V1_SCOPE, SCHEMA, API, SYSTEM_DESIGN, TASKS, this log |
| GitHub | Private repo https://github.com/hasanmahdi2007/haddak, CI running |
| Local database | Postgres 16 + PostGIS in Docker, port 5433, seeded |
| Backend | All version 1 endpoints built, hardened and tested (244 tests); Docker image ready |
| Mobile app | Home, Results (list and map), Profile, Saved and Suggest screens built in the chosen design (option B), light and dark, English and Arabic; name search, directions, opening hours, favourites. Sign-in, provider sign-up, reviews and stats not started (need Supabase) |
| Hosting | Not started (plan in `SYSTEM_DESIGN.md` section 6) |

## Validation benchmark (from `PROJECT.md`)

The app is judged in the first area by this, not by code:

- 50+ providers listed, real searches, some providers got clients → keep going, expand.
- Providers listed but no searches → demand or marketing problem.
- Cannot get 50 free listings → rethink.

Current: 0 real providers (app not released). Seed data only.

## Log

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
