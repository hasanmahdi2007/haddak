import type { Strings } from '@/i18n/en';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * "Just now", "12 min ago", "3 h ago" or "Yesterday" for a date in the past.
 * Stories live for one day, so nothing older than "Yesterday" is needed.
 */
export function timeAgo(iso: string, s: Strings): string {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / MINUTE_MS);
  if (!Number.isFinite(minutes) || minutes < 1) return s.stories.justNow;
  if (minutes < 60) return s.stories.minutesAgo.replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return s.stories.hoursAgo.replace('{n}', String(hours));
  return s.stories.yesterday;
}

/**
 * Whole calendar days from today until a date: 0 means today, 1 tomorrow.
 * Counted from midnight to midnight, so the answer does not change during the day.
 */
export function daysUntil(iso: string): number {
  const end = new Date(iso);
  const today = new Date();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const thisDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.round((endDay - thisDay) / DAY_MS));
}
