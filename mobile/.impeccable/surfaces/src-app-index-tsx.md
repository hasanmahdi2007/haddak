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

How the direction was chosen: the stamped-paperwork direction (navy, beige) and then the sea-teal direction were both rejected by the founder. On 2026-11-16 he supplied a reference palette (rounded finance-dashboard cards, mint, lavender, near-black) and asked for the whole design to be rebuilt in that spirit.

## Direction contract

THESIS: Big rounded blocks of solid colour on a near-white page. Refused: thin outlines, gradients, glass, white text on pastel, list-of-rows layouts.

OWN-WORLD: Ink `#1B1C2F` for words and actions, mint `#A4F5A6` for trust, lavender `#B2A1FF` as the accent, soft grey `#EFF1EE` for containers. Beiruti for titles, Readex Pro for text. Radius 24 to 28, pill controls.

FIRST VIEWPORT: Home. Wordmark, an ink block with the question and a pill search field, one compact distance row, a two-column grid of colour blocks in alternating widths.

SIGNATURE MOVE: the mint Verified mark: pill on cards, check disc on map pins, a whole mint hero block on a verified profile.

FINISH: documented in `DESIGN.md`. Verified in the web build only; not yet on an Android device.

## Unresolved

- No logo exists; the wordmark is set in type.
- Suggest keeps its earlier form layout with the new palette.
- Map pin labels overlap where providers are dense; no collision handling yet.
