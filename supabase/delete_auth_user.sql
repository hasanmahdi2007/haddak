-- Haddak: lets the API delete a user's sign-in account (DELETE /api/v1/me).
--
-- Run once in the Supabase SQL editor of the hosted project (as `postgres`).
-- Safe to run again. Applied to project wamwmhanxqvftrwqlyfh (Frankfurt) on 2026-11-21.
--
-- Why a function and not a Supabase secret key on the server: the secret
-- (service role) key can read and change everything, every user's files
-- included. This function can do exactly one thing: delete one row of
-- auth.users by id. The API's own role, haddak_api, may call it and nothing
-- else may.
--
-- `security definer`: it runs with the rights of its owner (postgres), which
-- may delete from auth.users; haddak_api may not.
-- `set search_path = ''`: names inside are fully qualified, so nobody can
-- slip in a look-alike table or function.
-- The schema is not `public`, so Supabase's Data API (PostgREST) never
-- exposes it as an RPC.
--
-- Deleting the auth.users row also deletes the user's sessions and
-- identities (Supabase's own foreign keys cascade). Their files in Storage
-- are deleted by the app before it calls the API (see
-- backend/app/services/account_deletion.py).

create schema if not exists haddak_private;
revoke all on schema haddak_private from public;
grant usage on schema haddak_private to haddak_api;

create or replace function haddak_private.delete_auth_user(user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = user_id;
$$;

revoke all on function haddak_private.delete_auth_user(uuid) from public, anon, authenticated;
grant execute on function haddak_private.delete_auth_user(uuid) to haddak_api;
