import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

import { isMockMode } from '@/api';

import { supabase } from './supabase';

/**
 * Photo upload for the business form (docs/API.md, "Photos and proof documents").
 *
 * The app sends the file straight to Supabase Storage with the user's own
 * session, then gives the resulting link to the backend. The backend never
 * sees the file itself.
 *
 * - `photo`: bucket `provider-photos` (public). The result is the public URL.
 * - `proof`: bucket `verification-docs` (private). The result is a signed URL
 *   that works for a year, so the founder can open it from the admin page.
 *
 * Files go under a folder named after the user's id (`<user id>/<file>.jpg`):
 * the storage rules in `supabase/storage_setup.sql` only allow writing there.
 */

export type UploadKind = 'photo' | 'proof';

/**
 * - mock: no backend; uploads return placeholder links at once.
 * - storage: real uploads to Supabase Storage.
 * - none: the build has no Supabase settings, so nothing can be uploaded.
 */
export type UploadMode = 'mock' | 'storage' | 'none';

export type UploadFailure =
  /** Supabase is not set up in this build. */
  | 'unavailable'
  /** No Supabase session (signed out, or the development token). */
  | 'signedOut'
  /** The upload itself failed: offline, bucket missing, refused by the rules. */
  | 'failed';

export class UploadError extends Error {
  reason: UploadFailure;
  constructor(reason: UploadFailure, message: string) {
    super(message);
    this.name = 'UploadError';
    this.reason = reason;
  }
}

export const BUCKETS: Record<UploadKind, string> = {
  photo: 'provider-photos',
  proof: 'verification-docs',
};

/** Long side of an uploaded photo, in pixels, and its JPEG quality. */
const LONG_SIDE = 1600;
const JPEG_QUALITY = 0.8;
/** How long the link to a proof document keeps working: one year. */
const PROOF_LINK_SECONDS = 365 * 24 * 60 * 60;

export function uploadMode(): UploadMode {
  if (isMockMode) return 'mock';
  return supabase ? 'storage' : 'none';
}

/** Shrinks the picked image to 1600 px on its long side and returns it as JPEG bytes. */
async function toJpeg(uri: string): Promise<ArrayBuffer> {
  const refs: ImageRef[] = [];
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    refs.push(original);
    let image = original;
    if (Math.max(original.width, original.height) > LONG_SIDE) {
      // Giving only one side keeps the proportions.
      const resize = original.width >= original.height ? { width: LONG_SIDE } : { height: LONG_SIDE };
      image = await ImageManipulator.manipulate(original).resize(resize).renderAsync();
      refs.push(image);
    }
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
    if (!saved.base64) throw new Error('No image data');
    return base64ToBytes(saved.base64);
  } finally {
    // The decoded images live in native memory until released.
    refs.forEach((ref) => ref.release());
  }
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 text to bytes. Written out because `atob` is not on every React Native engine. */
function base64ToBytes(text: string): ArrayBuffer {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byte = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64.indexOf(clean[i]);
    const b = BASE64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? BASE64.indexOf(clean[i + 2]) : 0;
    const d = i + 3 < clean.length ? BASE64.indexOf(clean[i + 3]) : 0;
    const bits = (a << 18) | (b << 12) | (c << 6) | d;
    if (byte < bytes.length) bytes[byte++] = (bits >> 16) & 255;
    if (byte < bytes.length) bytes[byte++] = (bits >> 8) & 255;
    if (byte < bytes.length) bytes[byte++] = bits & 255;
  }
  return bytes.buffer;
}

let mockCount = 0;

/**
 * Uploads one picked image and returns the link to store in the profile.
 * Throws UploadError when it cannot.
 */
export async function uploadImage(kind: UploadKind, uri: string): Promise<string> {
  const mode = uploadMode();
  if (mode === 'mock') {
    // Mock mode has no storage: a short pause, then a placeholder link.
    await new Promise((resolve) => setTimeout(resolve, 500));
    mockCount += 1;
    return kind === 'photo'
      ? `https://picsum.photos/seed/haddak-${Date.now()}-${mockCount}/1200/900`
      : `https://example.com/mock-proof/${Date.now()}-${mockCount}.jpg`;
  }
  if (mode === 'none' || !supabase) {
    throw new UploadError('unavailable', 'Supabase is not configured');
  }

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new UploadError('signedOut', 'No Supabase session');

  let bytes: ArrayBuffer;
  try {
    bytes = await toJpeg(uri);
  } catch (cause) {
    throw new UploadError('failed', `Could not read the image: ${String(cause)}`);
  }

  // A name nobody else will pick: the time plus a random part.
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const bucket = supabase.storage.from(BUCKETS[kind]);
  const uploaded = await bucket.upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploaded.error) throw new UploadError('failed', uploaded.error.message);

  if (kind === 'photo') return bucket.getPublicUrl(path).data.publicUrl;

  const signed = await bucket.createSignedUrl(path, PROOF_LINK_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new UploadError('failed', signed.error?.message ?? 'No signed link');
  }
  return signed.data.signedUrl;
}
