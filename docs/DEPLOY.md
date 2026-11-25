# Deploying Haddak

How Haddak runs in production, what is already done, the steps only the
founder can do (they need the founder's own accounts, passwords or payment), and what to do
when something goes wrong. Architecture and reasons: `SYSTEM_DESIGN.md` §6.

## What runs where

| Piece | Where | State |
|---|---|---|
| Database | Supabase project `wamwmhanxqvftrwqlyfh` (`haddak-eu`), Postgres 17, region Frankfurt (`eu-central-1`) | **Done (2026-11-21).** Extensions in `extensions`, role `haddak_api`, migrations up to 0015, OpenStreetMap listings imported, `supabase/delete_auth_user.sql` and `supabase/storage_setup.sql` applied, Security Advisor clean. |
| Sign-in, photo storage | The same Supabase project | Working. Emails still come from Supabase's own sender until SMTP is set (step 2). |
| API | Render, region Frankfurt, Docker, from `render.yaml` | Ready; needs the founder's Render account (step 1). The image was built and run against the live database on 2026-11-21. |
| Android app | Expo EAS Build, profiles in `mobile/eas.json` | Ready; needs the founder's Expo account (step 4). |
| Backups | GitHub Actions, `.github/workflows/backup.yml`, every Monday | Ready; needs two GitHub secrets (step 3). |

Secrets are never in the repository (it is public). The production values
made on 2026-11-21 are in **`backend/.env.production`** on the founder's
laptop, which git ignores: `DATABASE_URL` (the `haddak_api` login),
`BACKUP_DATABASE_URL` (the same, without `+psycopg`) and `BACKUP_PASSPHRASE`.
Keep a copy of that file in a password manager: the backups cannot be opened
without the passphrase.

## Steps only the founder can do

### 1. Put the API online (Render), about 10 minutes

1. Sign up at render.com with GitHub and give it access to the `haddak` repository.
2. **New → Blueprint**, pick the repository. Render reads `render.yaml` and
   shows one web service, `haddak-api`.
3. It asks for the two secrets:
   - `DATABASE_URL`: copy it from `backend/.env.production`. It must end with
     `?sslmode=require` (add it if it is missing): since 2026-11-25 the API
     refuses to start in production without it, so the connection to the
     database is always encrypted. While there, turn on Supabase →
     Database → Settings → **Enforce SSL**.
   - Jarak's AI keys (leave a key empty and the sentences that would go to
     that provider get the free keyword search instead). Since 2026-11-25:
     - `OPENAI_API_KEY`: from platform.openai.com → API keys (GPT-6 Luna,
       most sentences).
     - `GEMINI_API_KEY`: from aistudio.google.com → Get API key, in a Google
       Cloud project **with billing on** (Gemini 3.8 Flash, Arabizi). On the
       free tier Google may use the sentences to improve its products.
     - `ANTHROPIC_API_KEY`: only if `ASSIST_MODEL` is set back to a Claude
       model.
     Then, on the laptop, run the phrase test once per model and compare with
     the table in `docs/AI_ASSISTANT.md`:
     `python scripts/eval_assist.py --model gpt-6-luna`, then
     `--model gemini-3.8-flash`, then `--route` (a few cents in total).
   - `CONTACT_EMAIL`: the Haddak Gmail address from step 2. It is shown on
     `/privacy`, `/terms` and `/delete-account` (Google Play needs a contact).
   - `SENTRY_DSN`: optional, see step 5. Leave empty for now if you like.
4. **Apply.** The first build takes a few minutes. When it is live, open
   `https://haddak-api-ub67.onrender.com/api/v1/health`: it must say `{"status":"ok"}`.
   Then run the full outside check from the `backend` folder:
   `python scripts/smoke_test.py https://haddak-api-ub67.onrender.com` (all `ok`).
5. If Render gave the service a different address (the name was taken),
   tell Claude: it changes `EXPO_PUBLIC_API_URL` in `mobile/eas.json` and the
   Supabase URLs in step 2.
6. `ADMIN_API_KEY` was made by Render: open the service → Environment to see
   it. That is the key for `https://haddak-api-ub67.onrender.com/admin`.

The free plan sleeps after 15 minutes without requests, and the first
request after that takes about a minute. **Switch the plan to Starter
($7/month) in Render before the first outside tester** (testers are users:
the Google Play closed test runs 14 days on this server). Then also move the
migrations out of the start-up path (see "Migrations" below).

Render checks `/api/v1/live` (`healthCheckPath`), which does not touch the
database, so a database problem never makes Render restart the API.

### 2. Sign-in emails from "Haddak", about 10 minutes

1. Make a Gmail account for Haddak, turn on 2-step verification, then
   Google Account → Security → **App passwords** → make one.
2. Supabase → Authentication → **Emails → SMTP Settings** → enable custom SMTP:
   host `smtp.gmail.com`, port `465`, username = that Gmail address,
   password = the app password, sender email = the same address,
   **sender name `Haddak`**.
3. Supabase → Authentication → Emails → **Templates**: paste
   `supabase/templates/sign-in.html` into "Magic link or OTP" and into
   "Confirm sign up". Subject: `رمز الدخول إلى حدّك / Your Haddak code`.
   The email then shows a 6-digit code the user types in the app, which
   works on any phone and network without depending on the link.
4. Supabase → Authentication → **URL Configuration** (after step 1):
   - Site URL: `https://haddak-api-ub67.onrender.com/auth/open?app=haddak%3A%2F%2Fauth-callback`
     (replaces `http://localhost:3000`, the cause of "localhost:3000 isn't connected").
   - Redirect URLs: exactly `https://haddak-api-ub67.onrender.com/auth/open**`
     and `haddak://auth-callback`. **Remove** `exp://**`, `haddak://**` and
     every `http://192.168.*.*` entry from the production project (security
     audit 2026-11-25): an `exp://` link can point to anyone's server, so a
     sign-in email could hand the code to a stranger's Expo Go project. The
     API's `/auth/open` page also refuses `exp://` in production. For Expo Go
     testing use a separate development Supabase project (or the 6-digit
     code, which needs no redirect).
5. **Sign-in settings to check in the Supabase dashboard** (they are managed
   there, not in `supabase/config.toml`, whose `[auth]` part holds local
   defaults and must never be pushed to production as it stands):
   - Authentication → Sign In / Providers → **Email**: "Confirm email" ON.
     The app signs in with emailed codes only; password sign-up must not
     give a working account without a confirmed email (turn password
     sign-in off if the dashboard offers it).
   - **Anonymous sign-ins: OFF** (the API also refuses anonymous tokens).
   - Email OTP length: **6** (the app's code box expects 6 digits).
   - Write the date you checked into `PROGRESS.md`.
6. **Storage cap per user** (2026-11-25): run `supabase/storage_setup.sql`
   again in the SQL editor (safe to re-run). It now limits each user to 100
   files in `provider-photos` and 10 in `verification-docs`. Check: upload
   a photo in the app once afterwards; it must still work.

### 3. Turn on the weekly backup, about 2 minutes

GitHub → the `haddak` repository → Settings → Secrets and variables →
Actions → **New repository secret**, twice:
- `BACKUP_DATABASE_URL`: the value from `backend/.env.production`.
- `BACKUP_PASSPHRASE`: the value from `backend/.env.production`.

Then Actions → "database backup" → **Run workflow** once to check it is green.

### 4. Build the Android test app (EAS), about 20 minutes, mostly waiting

```bash
npm install -g eas-cli
cd mobile
eas login                      # your Expo account
eas init                       # links the project; accept
eas build -p android --profile preview
```

**Google Maps key for the map and the pin picker (about 15 minutes, once).**
Expo Go brings its own Maps key, a real build does not. Without a key the app
still works, but the Results map and the "Your place on the map" picker show a
plain preview with a note instead of a live map.

1. console.cloud.google.com → create a project "Haddak" (a card on file is
   required; the Maps SDK for Android itself has no charge for map display).
2. APIs & Services → Library → enable **Maps SDK for Android**.
3. APIs & Services → Credentials → Create credentials → **API key**. Edit it:
   - Application restrictions: **Android apps** → Add: package name
     `app.haddak`, and the **SHA-1** of the EAS signing key (run
     `eas credentials -p android` in `mobile/`, choose the build profile, and
     copy "SHA1 Fingerprint"). Add the Play App Signing SHA-1 too once the app
     is on Google Play (Play Console → Setup → App signing).
   - API restrictions: **Restrict key** → only *Maps SDK for Android*.
4. Store it in EAS, never in git:
   `eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --environment preview --environment production --visibility sensitive`
   (`mobile/app.config.ts` reads it at build time).
5. Build again. Check on the phone: Results → Map shows streets, and
   "List your business" shows a map you can drag the pin on.

**Release builds and fake data.** A release build made without
`EXPO_PUBLIC_API_URL` refuses to start, so a build full of made-up businesses
cannot reach testers by accident. The `preview` and `production` profiles set
it. For a deliberate demo build, also set `EXPO_PUBLIC_ALLOW_MOCK=1`; the app
then shows a "Demo data" pill on Home.

**App crash reports.** The app has no crash reporting yet (the backend's Sentry
in step 5 covers only the server). `@sentry/react-native` was tried on
2026-11-25 and left out: it added 4 moderate `npm audit` findings and a build
step that uploads source maps and needs a Sentry auth token. Until then, a
screen that crashes shows "Something went wrong" with Try again.

The result is a link to an `.apk` that installs on any Android phone (send
the link on WhatsApp to testers). It talks to the hosted API, not your laptop.
For Google Play later: `eas build -p android --profile production` makes the
`.aab` file the Play Console wants ($25 developer account, then a 14-day
closed test with at least 12 testers before the public release).

### 5. Hear about problems first, about 10 minutes

1. **External uptime monitor (the main alarm), about 5 minutes, free:** sign
   up at uptimerobot.com (or betterstack.com), add an **HTTP(s)** monitor for
   `https://haddak-api-ub67.onrender.com/api/v1/health`, interval **5 minutes**,
   alert by email and by the phone app's push notification. `/health` also
   checks the database, so it catches a paused or broken Supabase too.
   Expect a few alerts a day while Render is on the free plan (sleeping);
   they stop on Starter.
2. **Uptime check from GitHub (second line):** GitHub → repository → Settings → Secrets and variables →
   Actions → **Variables** tab → New repository variable: name `API_URL`,
   value `https://haddak-api-ub67.onrender.com`. `.github/workflows/uptime.yml` then
   runs the full smoke test every 30 minutes and GitHub emails you when it fails.
   GitHub's schedule is often late by 10–60 minutes, which is why the monitor
   above comes first.
3. **Crash reports (optional, free):** sign up at sentry.io (Developer plan),
   create a project of type **FastAPI**, copy its DSN, and paste it into
   Render → haddak-api → Environment as `SENTRY_DSN`. Render redeploys by itself.
   Every error report carries a `request_id` tag; the same id is in the Render
   log line (`req=...`) and in the `X-Request-ID` header the app received.
   Sentry also emails you the first time each day or month the assistant's
   AI budget is reached (everyone then gets keyword answers).
4. **Slow queries, weekly while the app is young:** Supabase → Reports →
   **Query performance** lists the slowest and most frequent queries
   (`pg_stat_statements`). Anything that takes over about 100 ms on average
   deserves a look.

### 6. Google Play, when the test APK works

1. Developer account at play.google.com/console ($25 once; identity check).
2. Create the app; store listing in Arabic and English.
3. **Privacy policy URL:** `https://haddak-api-ub67.onrender.com/privacy`.
4. **Data safety form** (what the app collects), matching `/privacy`: email
   address (account), approximate and precise location (used for search, not
   stored), user content (reviews, photos), app interactions (follows, hire
   checks), device id (install id, hashed). Encrypted in transit: yes.
   Users can request deletion: yes.
5. **Account deletion URL:** `https://haddak-api-ub67.onrender.com/delete-account`.
6. Content rating questionnaire; target audience 13+.
7. `eas build -p android --profile production`, upload the `.aab` to a
   **closed test**, invite at least 12 testers, keep them opted in for 14
   days, then apply for production.

## Every deploy after that

Push to `main`. GitHub runs the checks (`.github/workflows/`); if they pass,
Render builds the image, the migrations run (see below), then the API
starts. Watch it under Render → haddak-api → Events / Logs.

**Migrations.** On the free plan the container runs `alembic upgrade head`
each time it starts (`RUN_MIGRATIONS=true`, the default in the Dockerfile),
because the free plan has no pre-deploy step. Once on Starter or higher:
1. in `render.yaml`, uncomment `preDeployCommand: alembic upgrade head`;
2. add the variable `RUN_MIGRATIONS` = `false` (in `render.yaml` under
   `envVars`, or in Render → haddak-api → Environment);
3. push. Render then runs the migrations once per deploy, before switching
   traffic, and a restart or an unreachable database no longer blocks the
   API from starting.

Migrations wait at most 5 s for a table lock (then fail: just deploy again
at a quieter moment), may run 10 minutes per statement, and two containers
never migrate at the same time (`backend/alembic/env.py`).

**After each deploy:** run `python scripts/smoke_test.py https://haddak-api-ub67.onrender.com`
(the uptime check runs the same thing every 30 minutes), search once in the
app, and glance at the logs for errors.

**Migrations must not break the running version.** During a deploy the old
container serves requests while the new one migrates. So: add columns as
nullable or with a default; rename or drop in two deploys (first stop using
it, then remove it). Every new table needs `ENABLE ROW LEVEL SECURITY` and
every new function `SET search_path = ''` (the tests check both).

## When something goes wrong

| Problem | What to do |
|---|---|
| The new version is broken | Render → haddak-api → Events → an earlier deploy → **Rollback**. If that deploy had a migration, the old code still works as long as the rule above was kept. |
| `/health` fails | `/api/v1/live` still answers: the API is up and the database is the problem. Check Supabase is not paused (free projects pause after a week without activity; Dashboard → Restore) and not over 500 MB (read-only). If `/live` fails too: Render logs; "Refusing to start in production" lists the missing setting. |
| Many 503 "database is busy" answers | Too many requests for the connection pool, or slow queries. Render logs show `database error` lines with the cause; Supabase → Reports → Query performance shows slow queries. The pool is sized in `SYSTEM_DESIGN.md` §6, "Connection budget". |
| `DELETE /me` answers 503 | The function that deletes sign-in accounts is missing (Render logs say so). Run `supabase/delete_auth_user.sql` in the Supabase SQL editor; nothing was deleted, users can try again. |
| Jarak gives only keyword answers to everyone | The daily ($1) or monthly ($10) AI cap was reached, or the Anthropic key is missing. `assist_log` shows the spending. |
| Signed-in actions answer 503 "Sign-in check unavailable" | The API could not download Supabase's signing keys (logged as an error, so Sentry emails). It keeps the last keys it had and retries every 30 s; if it never had any, check `SUPABASE_JWKS_URL` and Supabase's status page. Users are not signed out by a 503. |
| Many 429 "Too many requests" in the logs | The per-caller limits (`docs/API.md`, "Rate limits") may be too low for people sharing one carrier address. Also check the "X-Forwarded-For carries N entries" line logged at start: N must be at least `PROXY_HOPS`, or everyone shares one allowance. |
| A leaked key | Change it at its source (Anthropic console, Render environment, or for the database: `ALTER ROLE haddak_api PASSWORD '...'` in the Supabase SQL editor, then update `DATABASE_URL` in Render and the backup secret). Push protection on GitHub blocks most keys before they are pushed. |

## Backups

`.github/workflows/backup.yml` runs every Monday and keeps each encrypted
dump 30 days. **What it covers and what it does not:**

| Part | In the weekly dump? | If it is lost |
|---|---|---|
| Haddak's tables (schema `public`): providers, reviews, stories, categories, ... | **Yes** | Restore below. Up to 7 days of changes are lost (RPO 7 days). |
| Sign-in accounts (Supabase's `auth` schema: emails, user ids) | **Only if** the optional secret `BACKUP_AUTH_DATABASE_URL` is set (below) | Without it, every user gets a new user id when they sign up again, so owners lose their business profile and reviewers their reviews. |
| Photos and proof documents (Supabase Storage) | **No** | Gone. Owners must upload them again. |
| The `haddak_api` role, `delete_auth_user`, storage rules, sign-in settings | No, but they are in the repository | Rebuilt by the steps below. |

**What the founder can do about the gaps:**
- **Best, before the public launch:** Supabase **Pro** ($25/month) keeps daily
  backups of the whole database, `auth` included, for 7 days, and has no pause.
  Storage files are still not in database backups.
- **Free, for sign-in accounts:** add a second GitHub secret,
  `BACKUP_AUTH_DATABASE_URL`: the session-pooler address for the **`postgres`**
  user (Supabase → Connect → Session pooler, with the database password;
  without `+psycopg`). The backup then also saves the `auth` tables' data
  (encrypted the same way). It is a separate secret on purpose: `haddak_api`
  cannot read `auth`, and the `postgres` password is more powerful, so keep it
  only there and in the password manager. Without this secret the workflow
  works exactly as before. After adding it, run the workflow once by hand
  (Actions → "database backup" → Run workflow) and check the artifact now
  holds two files; if the auth step fails on a permission error, tell Claude
  (Supabase sometimes restricts some `auth` tables even for `postgres`).
- **Photos:** now and then, download both buckets (Supabase → Storage →
  bucket → select the files → Download; or ask Claude to script it with the
  Supabase CLI's `storage` commands) and keep them on a disk. Fine while there
  are few photos.

### Restoring the tables

1. GitHub → Actions → "database backup" → a run → download the artifact (a zip
   with `haddak-YYYY-MM-DD.dump.gpg`, and `haddak-auth-YYYY-MM-DD.dump.gpg`
   when the auth secret is set).
2. Decrypt: `gpg --decrypt haddak-YYYY-MM-DD.dump.gpg > haddak.dump` (asks
   for `BACKUP_PASSPHRASE`).
3. Into an empty database, with the extensions where Supabase keeps them:
   ```sql
   CREATE SCHEMA IF NOT EXISTS extensions;
   CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
   CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
   ALTER DATABASE <name> SET search_path = public, extensions;  -- then reconnect
   ```
   then `pg_restore --no-owner --dbname "<database url>" haddak.dump`.
   One error, `schema "public" already exists`, is expected and harmless.

### Rebuilding everything (a new Supabase project)

For when the project is lost (deleted, account problem, paused past the
restore window). Target time (RTO): about half a day of the founder's time.
In this order:

1. **Project:** create it in Frankfurt (`eu-central-1`). Note the project ref.
2. **Role and extensions:** in the SQL editor (as `postgres`), run
   **`supabase/role_setup.sql`**, then
   `alter role haddak_api password '<new long random value>';`
   (store it in the password manager).
3. **Sign-in accounts first**, if you have an auth dump: decrypt it and
   `pg_restore --data-only --no-owner --dbname "<postgres url>" haddak-auth.dump`
   (as `postgres`; the new project's `auth` tables already exist and must be
   empty). This keeps every user's id, so owners and reviews still match.
4. **Tables:** restore the `public` dump as `haddak_api` (steps above; the
   extensions already exist from step 2). Then, from `backend/`, with
   `DATABASE_URL` pointing at the new project: `alembic upgrade head` (applies
   any migration newer than the dump).
5. **Functions and storage rules** (as `postgres`): `supabase/delete_auth_user.sql`,
   then `supabase/storage_setup.sql`. Without the first, account deletion
   refuses with 503 in production (on purpose).
6. **Sign-in settings:** SMTP, the email template and the URL configuration
   (step 2 above, by hand in the dashboard; do not `supabase config push`
   the committed `config.toml`, see step 2.5).
7. **Photos:** upload the saved bucket copies, if any.
8. **Point everything at it:** `DATABASE_URL` in Render, the backup secrets in
   GitHub, `SUPABASE_JWKS_URL` and `SUPABASE_URL` in `render.yaml`, and the
   Supabase URL and publishable key in `mobile/eas.json` (a new app build).
9. Run `python scripts/smoke_test.py https://haddak-api-ub67.onrender.com`.

## Keeping the database small

About once a month (and before the free plan's 500 MB gets close; Supabase →
Reports → Database shows the size), from `backend/` with `DATABASE_URL` set to
the production value from `backend/.env.production`:

```bash
python scripts/retention.py          # dry run: shows what it would do
python scripts/retention.py --apply  # does it
```

It deletes stories that expired over 30 days ago and assistant logs older than
180 days, and turns contact events older than about 3 months into monthly
totals (`docs/SCHEMA.md`, "Retention").

## Measuring capacity

Before the public launch, once on Starter: run
`python scripts/load_test.py https://haddak-api-ub67.onrender.com --seconds 60 --concurrency 20`
at a quiet hour and write the result into `SYSTEM_DESIGN.md` §7. The per-IP
rate limit will answer 429 to one machine early; that part of the output shows
the limiter working, not the server's limit, so look at the successful
requests per second and their times.

Tested on 2026-11-21: a production dump was encrypted, decrypted and
restored into a fresh Postgres 17 + PostGIS; categories, places, the
migration version, Row Level Security on all 16 tables and `normalize_name()`
all came back.

## Region: Frankfurt (moved on 2026-11-21)

The first Supabase project was created in Seoul by accident (Lebanon to Seoul
is about 250 ms each way, and a search makes about seven database round
trips, so a search took about 2.5 s). On 2026-11-21, before any real users,
everything moved to Frankfurt: a new project `wamwmhanxqvftrwqlyfh`
(`haddak-eu`, made with the Supabase CLI), set up like the old one
(extensions, `haddak_api` role, migrations, `supabase/storage_setup.sql`,
`supabase/delete_auth_user.sql`), and the data copied with `pg_dump
--data-only` (categories and places come from the migrations and were
identical). Sign-in settings (Site URL, redirect URLs, 6-digit codes) were
pushed with `supabase config push`. Render runs in Frankfurt too.

The Seoul project (`ginifqwdlqkbsptiahun`) is **paused**, not deleted; the
free plan allows two active projects. Delete it from the dashboard once
Frankfurt has run without trouble for a while.

The email template can only be set after custom SMTP is on (a free-plan
rule): after step 2.2, paste `supabase/templates/sign-in.html` by hand as in
step 2.3. Do **not** run `supabase config push` with the committed
`supabase/config.toml`: its `[auth]` part holds local defaults (Site URL
`127.0.0.1:3000`, "Confirm email" off) and would overwrite production.
