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

How the direction was chosen: the round ran unattended (subagent, no question tool, no user to open the decision page). Seven grounded candidates from the audience's world, ordered by resonance: (1) hand-painted Arabic shop signs, (2) Beirut cement floor tiles, (3) stamped paperwork: the mukhtar's round ink seal and the fiscal stamp, (4) blue enamel street and sector plaques, (5) classified-ads paper and the yellow pages, (6) sandstone house with green shutters, (7) sweets-shop box. The roll assigned candidate 3. All six catalog challengers were declined (dark instrument and poster worlds lose on both audience identification and product clarity for a daylight, trust-first directory); two raises were kept from them.

## Direction contract

THESIS: In Lebanon a thing is true once it carries the stamp. Haddak's verification is drawn as that stamp, so trust is the first thing seen on every provider. Refused: the delivery-app arrangement of gradient hero, promo carousel and floating shadowed cards.

OWN-WORLD: Stamp-pad ink blue as the one shell and action colour, on warm document paper with white sheets and a manila tint for tiles. Four inks with one meaning each: ink blue (trust and action), saffron (merit: ratings and featured), cedar green (founding member), carmine (errors only). WhatsApp green belongs to WhatsApp. Type: Beiruti for titles, Readex Pro for text and controls, both drawn for Arabic and Latin together; Aref Ruqaa only inside the seal. Flat surfaces with hairlines, no drop shadows.

STORY: The visitor understands in one screen that this is a list of checked people near them, believes it because the seal, the review count and the price sit on every card, and taps WhatsApp.

FIRST VIEWPORT: Home. An ink-blue header holds the Haddak wordmark, the language switch, the question "Who do you need nearby?" and the current area. Below on paper, a three-column category grid of line icons on manila tiles. A docked bottom bar holds the four radius chips and one full-width search button whose label names the chosen category.

SIGNATURE MOVE: the verified seal, a round double-ring ink stamp set at a slight angle, large where the profile photo meets the page and small beside every name in the list; the founding-member badge is its companion, a perforated fiscal stamp.

RAISE (from the split-flap board): rating, distance and price sit in the same fixed columns on every result row, so the list scans vertically like a board.

RAISE (from the orienteering legend): each ink has exactly one meaning and is never borrowed for decoration.

FORM: stamped paperwork, position 3 of 7 on the ordered list. seed:154d08f3fc916849

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- The founder has not seen or approved this direction (task M4). A re-roll or a different candidate is cheap before M5 to M9 are built.
- No logo exists; the wordmark is set in type.
