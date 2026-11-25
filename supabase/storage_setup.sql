-- Haddak: Supabase Storage for business photos and proof documents.
--
-- Run once in the Supabase dashboard (SQL editor) of the hosted project, or with
-- `supabase db execute`. Safe to run again: it updates what already exists.
-- See docs/API.md, "Photos and proof documents".
--
-- How the app uses it (mobile/src/lib/upload.ts):
--   * It uploads with the signed-in user's own session (never a service key).
--   * Every file goes under a folder named after the user's id:
--       provider-photos/<auth.uid()>/<time>-<random>.jpg
--       verification-docs/<auth.uid()>/<time>-<random>.jpg
--   * provider-photos is a public bucket: the app stores the public URL.
--   * verification-docs is private: the app stores a signed URL valid for one
--     year, which the founder opens from the admin page. The founder can also
--     open the file in the dashboard (the service role ignores these rules).

-- ---------------------------------------------------------------------------
-- Buckets

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Public read: anyone with the link sees the photo (that is what a profile photo is for).
  ('provider-photos', 'provider-photos', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  -- Private: no public URL works; only the owner (and the service role) can read.
  ('verification-docs', 'verification-docs', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Row level security on storage.objects (Supabase turns RLS on for this table).
--
-- The rule everywhere: the first folder of the object's path must be the
-- user's own id. (storage.foldername('abc/x.jpg') is {'abc'}.)
-- `(select auth.uid())` is evaluated once per statement, not once per row.
--
-- Public reading of provider-photos needs no policy: the bucket is public, so
-- its public URLs bypass RLS. No "anyone may select" policy is added on purpose:
-- it would let anyone list every user's folder.

drop policy if exists "haddak: owners upload to their folder" on storage.objects;
drop policy if exists "haddak: owners read their folder" on storage.objects;
drop policy if exists "haddak: owners update their folder" on storage.objects;
drop policy if exists "haddak: owners delete from their folder" on storage.objects;

-- Upload: signed-in users, into their own folder, in the two Haddak buckets only,
-- and at most a fixed number of files per user and bucket (added 2026-11-25,
-- security audit M7): without a cap, one throwaway account could fill the
-- project's storage with 5 MB files and break every other user's uploads.
--   provider-photos:   100 files per user (up to 10 profile photos, replaced
--                      now and then, plus story images)
--   verification-docs:  10 files per user (a proof or two per claim)
-- 100 x 5 MB is still half of the free plan's 1 GB, so this slows abuse down
-- rather than making it impossible; deleting a user's old files (for example
-- images of expired stories) frees their allowance again.
-- The count reads the user's own folder, which the "read their folder" policy
-- below already allows; `name like '<uid>/%'` can use Storage's name index.
create policy "haddak: owners upload to their folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('provider-photos', 'verification-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      bucket_id <> 'provider-photos'
      or (
        select count(*) from storage.objects existing
        where existing.bucket_id = 'provider-photos'
          and existing.name like (select auth.uid())::text || '/%'
      ) < 100
    )
    and (
      bucket_id <> 'verification-docs'
      or (
        select count(*) from storage.objects existing
        where existing.bucket_id = 'verification-docs'
          and existing.name like (select auth.uid())::text || '/%'
      ) < 10
    )
  );

-- Read through the API: only your own files. For verification-docs this is the
-- only way in, and it is what lets the app create the signed link after upload.
create policy "haddak: owners read their folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('provider-photos', 'verification-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Replace a file (upsert): only your own, and it must stay in your folder.
create policy "haddak: owners update their folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('provider-photos', 'verification-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('provider-photos', 'verification-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Delete: only your own files.
create policy "haddak: owners delete from their folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('provider-photos', 'verification-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
