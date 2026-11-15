# Haddak — progress log

What has been built, how it was checked, and what is still open. Newest entry first. The task board with per-task status is `TASKS.md`.

## Where things stand

| Area | State |
|---|---|
| Project docs | Written: PROJECT, V1_SCOPE, SCHEMA, API, SYSTEM_DESIGN, TASKS, this log |
| GitHub | Private repo https://github.com/hasanmahdi2007/haddak, CI running |
| Local database | Postgres 16 + PostGIS in Docker, port 5433, seeded |
| Backend | All version 1 endpoints built, hardened and tested (103 tests); Docker image ready |
| Mobile app | Home, Results and Profile built in the chosen design (option B, white and sea teal), light and dark, English and Arabic. Map, sign-in, provider sign-up and reviews not started |
| Hosting | Not started (plan in `SYSTEM_DESIGN.md` section 6) |

## Validation benchmark (from `PROJECT.md`)

The app is judged in the first area by this, not by code:

- 50+ providers listed, real searches, some providers got clients → keep going, expand.
- Providers listed but no searches → demand or marketing problem.
- Cannot get 50 free listings → rethink.

Current: 0 real providers (app not released). Seed data only.

## Log

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
