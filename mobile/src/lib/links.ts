/** Links the app builds itself (docs/API.md, "Links the app builds itself"). */

/** https://wa.me/<number without +>?text=<prefilled greeting> */
export function whatsappUrl(number: string, greeting: string): string {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
}

/** tel:<number> */
export function telUrl(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

/**
 * https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>
 * A universal link: it opens the Google Maps app when installed, the browser otherwise.
 */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** https://haddak.app/p/<slug> (the domain is not registered yet). */
export function shareUrl(slug: string): string {
  return `https://haddak.app/p/${encodeURIComponent(slug)}`;
}
