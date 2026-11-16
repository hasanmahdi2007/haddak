/** What the backend accepts for every phone number: "+" and 8 to 15 digits. */
export const PHONE_PATTERN = /^\+\d{8,15}$/;

/**
 * The example number, wrapped in "left-to-right isolate" marks so that inside an
 * Arabic sentence the plus sign and the digit groups keep their order.
 */
export const PHONE_EXAMPLE = '⁦+961 70 123 456⁩';

/**
 * Turns what people type into the international form the backend wants.
 * "+961 70-123 456" and "00961 70 123 456" both become "+96170123456".
 * People in Lebanon usually type the local form, so "70 123 456" and
 * "03 123 456" (7 or 8 digits, with or without the leading 0) get +961 added.
 * (The same rule as the Suggest form.)
 */
export function cleanPhone(typed: string): string {
  const compact = typed.replace(/[\s\-().]/g, '');
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (compact.startsWith('+')) return compact;
  const local = compact.startsWith('0') ? compact.slice(1) : compact;
  return /^\d{7,8}$/.test(local) ? `+961${local}` : compact;
}

/** "+96170123456" -> "+961 70 123 456", for showing a stored Lebanese number in a field. */
export function showPhone(stored: string | null): string {
  if (!stored) return '';
  const lebanese = /^\+961(\d{1,2})(\d{3})(\d{3})$/.exec(stored);
  return lebanese ? `+961 ${lebanese[1]} ${lebanese[2]} ${lebanese[3]}` : stored;
}
