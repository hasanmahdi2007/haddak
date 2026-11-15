import type { Strings } from '@/i18n/en';

/** The four distances from docs/V1_SCOPE.md. "City" is 20 km. */
export const RADIUS_OPTIONS = [500, 1000, 5000, 20000] as const;

export type RadiusM = (typeof RADIUS_OPTIONS)[number];

export const DEFAULT_RADIUS: RadiusM = 1000;

export function parseRadius(value: unknown): RadiusM {
  const n = Number(value);
  return (RADIUS_OPTIONS as readonly number[]).includes(n) ? (n as RadiusM) : DEFAULT_RADIUS;
}

/** The next wider choice, or null at "City". */
export function widerRadius(value: RadiusM): RadiusM | null {
  const index = RADIUS_OPTIONS.indexOf(value);
  return index < RADIUS_OPTIONS.length - 1 ? RADIUS_OPTIONS[index + 1] : null;
}

/** Chip label: "1 km". */
export function radiusLabel(s: Strings, value: RadiusM): string {
  switch (value) {
    case 500:
      return s.radius.r500;
    case 1000:
      return s.radius.r1000;
    case 5000:
      return s.radius.r5000;
    default:
      return s.radius.city;
  }
}

/** In a sentence: "within 1 km", "across the city". */
export function radiusPhrase(s: Strings, value: RadiusM): string {
  switch (value) {
    case 500:
      return s.radius.within500;
    case 1000:
      return s.radius.within1000;
    case 5000:
      return s.radius.within5000;
    default:
      return s.radius.withinCity;
  }
}
