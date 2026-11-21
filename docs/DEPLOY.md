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
   - `DATABASE_URL`: copy it from `backend/.env.production`.
   - `ANTHROPIC_API_KEY`: from console.anthropic.com (leave empty to run
     Jarak on the free keyword search only).
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
request after that takes about a minute. Switch the plan to Starter ($7/month)
in Render before inviting real users.

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
   - Redirect URLs: add `https://haddak-api-ub67.onrender.com/auth/open**`.
     Keep the `exp://**` and `http://192.168.*.*:8000/auth/open**` entries for development.

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

The result is a link to an `.apk` that installs on any Android phone (send
the link on WhatsApp to testers). It talks to the hosted API, not your laptop.
For Google Play later: `eas build -p android --profile production` makes the
`.aab` file the Play Console wants ($25 developer account, then a 14-day
closed test with at least 12 testers before the public release).

### 5. Hear about problems first, about 10 minutes

1. **Uptime check:** GitHub → repository → Settings → Secrets and variables →
   Actions → **Variables** tab → New repository variable: name `API_URL`,
   value `https://haddak-api-ub67.onrender.com`. `.github/workflows/uptime.yml` then
   checks the live API every 30 minutes and GitHub emails you when it fails.
2. **Crash reports (optional, free):** sign up at sentry.io (Developer plan),
   create a project of type **FastAPI**, copy its DSN, and paste it into
   Render → haddak-api → Environment as `SENTRY_DSN`. Render redeploys by itself.

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
Render builds the image, the container runs `alembic upgrade head`, then
starts. Watch it under Render → haddak-api → Events / Logs.

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
| `/health` fails | Render logs. "Refusing to start in production" lists the missing setting. A database error: check Supabase is not paused (free projects pause after a week without activity; Dashboard → Restore). |
| Jarak gives only keyword answers to everyone | The daily ($1) or monthly ($10) AI cap was reached, or the Anthropic key is missing. `assist_log` shows the spending. |
| A leaked key | Change it at its source (Anthropic console, Render environment, or for the database: `ALTER ROLE haddak_api PASSWORD '...'` in the Supabase SQL editor, then update `DATABASE_URL` in Render and the backup secret). Push protection on GitHub blocks most keys before they are pushed. |

## Backups

`.github/workflows/backup.yml` dumps schema `public` (Haddak's tables; not
Supabase's own accounts or photos) every Monday, encrypted. To restore:

1. GitHub → Actions → "database backup" → a run → download the artifact (a zip
   with `haddak-YYYY-MM-DD.dump.gpg`).
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
rule): after step 2.2, Claude pushes it with `supabase config push`, or paste
`supabase/templates/sign-in.html` by hand as in step 2.3.
