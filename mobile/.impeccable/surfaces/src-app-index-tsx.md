---
version: 1
slug: "src-app-index-tsx"
primary_target: "src/app/index.tsx"
related_targets: ["src/app/results.tsx","src/app/provider/[id].tsx"]
---

# Surface brief: search flow (Home, Results, Provider profile)

Scope: the three public screens of the Haddak app, `src/app/index.tsx`, `src/app/results.tsx`, `src/app/provider/[id].tsx`. Visitor mode: Operate. Build path: code-led (native app screens).

Audience and job: someone in Lebanon, on an Android phone, outdoors or at home in daylight, who needs a professional or shop nearby a few times a year. Task: pick a category and a distance, read a ranked list, open one profile, contact on WhatsApp or by phone. No typing, no account.

Content: categories (two levels), radius (500 m, 1 km, 5 km, city), provider cards (name, category, area, distance, rating and count, price, verified / founding member / featured), profile (photos, description, reviews, contact). States: loading, empty, error, location denied, no photo.

Constraints: Arabic and English as equals with full right-to-left; Material 3 structure and 48 dp targets; tokens only; mock data until the backend exists.

How the direction was chosen: the first direction (stamped paperwork: navy header, beige ground) was rejected by the founder as dull and sleepy. Three bright Home options were then built (`design-preview/options/OPTIONS.md`) and the founder chose option B, "Corniche", on 2026-11-15. Results and Provider profile were restyled to match, and a dark theme was derived from it.

## Direction contract

THESIS: Bright, crisp and awake. Trust comes from clarity: a white page, a teal seal, plain facts. Refused: beige or grey grounds, navy headers, gradients, drop shadows, promo carousels.

OWN-WORLD: Sea and white. Pure white ground, sea teal `#00708A` for the brand and every action, pale aqua surfaces for grouping, one coral point for "you are here". Amber for ratings and Featured, green for founding members, red for errors, WhatsApp green for WhatsApp only. Type: Beiruti for titles, Readex Pro for text and controls; Aref Ruqaa only inside the seal. Flat, no shadows.

FIRST VIEWPORT: Home. Teal wordmark, language switch, the question, the aqua location pill with a coral pin, a two-column grid of white tiles with solid teal icon squares, a docked distance track and one full-width teal search button.

SIGNATURE MOVE: the verified seal, a round double-ring teal mark: small with a check beside the word "Verified" on every card, large with the word موثّق across the edge of the profile sheet.

RAISE (kept): rating, distance and price sit in the same fixed columns on every result card, in an aqua strip.

RAISE (kept): each colour has exactly one meaning and is never borrowed for decoration.

FINISH: documented in `DESIGN.md`. Verified in the web build only; not yet on an Android device.

## Unresolved

- No logo exists; the wordmark is set in type.
- The Android adaptive icon background in `app.json` is still the old navy `#24338F`.
