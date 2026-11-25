-- Haddak: the database role the API logs in as (haddak_api).
--
-- Run once in the Supabase SQL editor of a NEW project (as `postgres`),
-- before the first migration. Safe to run again: it only creates what is
-- missing and sets the same limits again. The production project
-- (wamwmhanxqvftrwqlyfh) was set up by hand on 2026-11-21 with exactly these
-- settings; this file is the written record, so a rebuild does not depend
-- on memory (docs/DEPLOY.md, "Rebuilding everything").
--
-- NO PASSWORD HERE: the repository is public. Right after running this, set
-- one in the SQL editor (a long random value, e.g. from a password manager):
--     alter role haddak_api password '...';
-- and put it into DATABASE_URL (Render) and BACKUP_DATABASE_URL (GitHub).
--
-- Why a separate role and not `postgres`: haddak_api owns Haddak's tables
-- (so the migrations can change them) but is not a superuser, cannot read
-- Supabase's own `auth` and `storage` schemas, and has time limits, so a
-- runaway query or a forgotten transaction cannot hold the database.
--
-- The same script runs in CI against a plain Postgres (backend.yml), so the
-- migrations are tested as this role and not as a superuser.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'haddak_api') then
    create role haddak_api login nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$$;

-- At most 20 connections at once, whatever connects with this role: the
-- API's pool, a deploy overlap, the weekly backup, a migration, the
-- founder's SQL client. The API's own share is set in app/config.py
-- (DB_POOL_SIZE + DB_MAX_OVERFLOW); the budget is in docs/SYSTEM_DESIGN.md §6.
alter role haddak_api connection limit 20;

-- No statement may run longer than 30 s (the API sets a tighter 8 s on its
-- own connections; migrations raise it for themselves, see alembic/env.py).
alter role haddak_api set statement_timeout = '30s';
-- A transaction left open and idle for 60 s is ended by the server.
alter role haddak_api set idle_in_transaction_session_timeout = '60s';
-- On Supabase, postgis and pg_trgm live in the `extensions` schema. Without
-- it on the search path, `geography` and `gin_trgm_ops` are not found.
alter role haddak_api set search_path = public, extensions;

-- The extensions (Supabase: Database -> Extensions, or these two lines as
-- `postgres`). They must exist before the first migration.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Rights: connect, create and own Haddak's tables in `public`, use the
-- extensions. Nothing on `auth` or `storage`.
do $$
begin
  execute format('grant connect, temporary on database %I to haddak_api', current_database());
end
$$;
grant usage, create on schema public to haddak_api;
grant usage on schema extensions to haddak_api;

-- After this: run the migrations as haddak_api (alembic upgrade head, or let
-- the API's container do it), then supabase/delete_auth_user.sql and
-- supabase/storage_setup.sql. The full order is in docs/DEPLOY.md.
