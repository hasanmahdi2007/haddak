/**
 * One way to clean up text before comparing it, the phone's twin of the
 * backend's normalize_text() / normalize_name() (backend/app/services/assist/normalize.py):
 *   - lower case;
 *   - accents removed (é -> e) and Arabic marks removed (vowel signs, and the
 *     hamza on أ إ آ ؤ ئ, which people type inconsistently);
 *   - ة -> ه, ى -> ي, ٱ -> ا, and the stretching character ـ removed;
 *   - punctuation becomes a space; several spaces become one.
 *
 * So "صيدليّة", "صيدليه" and "Pharmacy " all compare the way people expect.
 */

// Marks left behind by NFKD: Latin accents, and Arabic vowel signs, shadda, sukun and hamza marks.
const MARKS = /[̀-ͯؐ-ًؚ-ٰٟۖ-ۭ]/g;
// Punctuation and symbols that separate words (Latin and Arabic).
const SEPARATORS = /[\s.,;:!?'"`()[\]{}\-_/\\|،؛؟…·•&+*#@%$^~<>=]+/g;

export function normalizeText(value: string): string {
  let text = value.toLowerCase();
  try {
    // NFKD splits "é" into "e" + accent and "أ" into "ا" + hamza mark.
    text = text.normalize('NFKD');
  } catch {
    // Very old engines without normalize(): the explicit letter rules below still apply.
  }
  return text
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(SEPARATORS, ' ')
    .trim();
}
