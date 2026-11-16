/**
 * Emergency numbers built into the app. The assistant shows these when a sentence
 * sounds like an emergency; numbers written by the AI are never shown
 * (docs/AI_ASSISTANT.md, "Emergencies").
 *
 * RE-CHECK THESE NUMBERS BEFORE EVERY RELEASE (last written down 2026-11-16).
 */
export const EMERGENCY_NUMBERS = [
  /** Lebanese Red Cross: ambulance. */
  { key: 'redCross', number: '140' },
  /** Civil Defence: fire and rescue. */
  { key: 'civilDefence', number: '125' },
] as const;

export type EmergencyKey = (typeof EMERGENCY_NUMBERS)[number]['key'];
