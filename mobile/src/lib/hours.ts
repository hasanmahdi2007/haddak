import type { DayKey, OpeningHours } from '@/api';

/** The week as the profile lists it: Monday first. */
export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** The day key for a date. JavaScript counts days from Sunday (0), hence the shift. */
export function dayKeyOf(date: Date): DayKey {
  return DAY_KEYS[(date.getDay() + 6) % 7];
}

/** "09:30" -> 570 minutes after midnight. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Whether a provider is open at `date`, by the same rule as the backend:
 * open from the opening minute up to, but not including, the closing minute.
 * Returns null when no hours were given. Used by the mock client only; with
 * the real backend the app shows the `open_now` it is sent.
 */
export function isOpenAt(hours: OpeningHours | null, date: Date): boolean | null {
  if (!hours) return null;
  const now = date.getHours() * 60 + date.getMinutes();
  const ranges = hours[dayKeyOf(date)] ?? [];
  return ranges.some(([open, close]) => now >= toMinutes(open) && now < toMinutes(close));
}

/** "15:05" -> { h: 3, mm: "05", pm: true }: the parts of a 12-hour clock time. */
export function to12Hour(time: string): { h: number; mm: string; pm: boolean } {
  const [hours, minutes] = time.split(':');
  const hour = Number(hours);
  return { h: hour % 12 === 0 ? 12 : hour % 12, mm: minutes, pm: hour >= 12 };
}
