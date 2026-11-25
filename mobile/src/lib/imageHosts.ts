import { isMockMode } from '@/api';

/**
 * Which image links the app is willing to load (docs/API.md, "Photos").
 *
 * Profile photos and story pictures must come from our own Supabase storage. A
 * listing that carried a link to some other server could make every phone that
 * shows it load a picture from there, which tells that server the viewer's IP
 * address and when they looked (a tracking pixel), and the picture could be
 * swapped after review. The backend checks the links too; this is the second lock.
 *
 * Also allowed: pictures still on the phone (a picked photo before it is
 * uploaded), and, in mock mode only, the stock-photo sites the fake data uses.
 */

/** "https://<project>.supabase.co" from the build settings, without a trailing slash. */
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const STORAGE_PREFIX = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/` : null;

/** Local previews: files on the phone, and the browser's own in-memory pictures on the web. */
const LOCAL = /^(file|content|ph|assets-library|blob):/i;
const LOCAL_DATA = /^data:image\//i;

/** Only the fake data in mock mode points at these. */
const MOCK_HOSTS = ['images.unsplash.com', 'picsum.photos'];

function hostOf(uri: string): string | null {
  const match = /^https:\/\/([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : null;
}

/** True when `uri` may be loaded as an image. */
export function isAllowedImage(uri: string | null | undefined): uri is string {
  if (!uri) return false;
  if (LOCAL.test(uri) || LOCAL_DATA.test(uri)) return true;
  if (STORAGE_PREFIX && uri.startsWith(STORAGE_PREFIX)) return true;
  if (isMockMode) {
    const host = hostOf(uri);
    return host !== null && MOCK_HOSTS.includes(host);
  }
  return false;
}
