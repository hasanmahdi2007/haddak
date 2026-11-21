/**
 * Deleting the signed-in user's account (Google Play requires it in the app).
 *
 * Order matters:
 * 1. The user's files in Supabase Storage (photos, proof documents), with their
 *    own session: the storage rules let a user delete only their own folder,
 *    so no server key that can touch everyone's files is needed.
 * 2. DELETE /api/v1/me: the backend removes every row about the user, then their
 *    sign-in account (backend/app/services/account_deletion.py).
 * 3. Sign out on this phone.
 *
 * If step 1 or 2 fails nothing further happens and the user can try again; both
 * steps are safe to repeat.
 */
import { api } from '@/api';

import { signOut } from './auth';
import { supabase } from './supabase';
import { BUCKETS, uploadMode } from './upload';

/** Supabase lists at most this many files per call. */
const PAGE = 100;

async function deleteMyFiles(): Promise<void> {
  if (uploadMode() !== 'storage' || !supabase) return; // mock mode: no real files
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return; // a development token has no storage folder

  for (const bucketName of Object.values(BUCKETS)) {
    const bucket = supabase.storage.from(bucketName);
    // Delete a page at a time until the folder is empty.
    for (;;) {
      const listed = await bucket.list(userId, { limit: PAGE });
      if (listed.error) throw listed.error;
      if (listed.data.length === 0) break;
      const removed = await bucket.remove(listed.data.map((file) => `${userId}/${file.name}`));
      if (removed.error) throw removed.error;
      // Storage answers "removed nothing" instead of an error when its rules
      // refuse; stop rather than ask again forever.
      if (removed.data.length === 0) break;
    }
  }
}

/** Throws when it could not finish; then nothing on this phone changes. */
export async function deleteAccount(): Promise<void> {
  await deleteMyFiles();
  await api.deleteMyAccount();
  await signOut();
}
