# Haddak design system

The visual rules for the Haddak app, as built. The code mirror of this file is `src/theme/tokens.ts`: change both together. Screens and components use tokens only, never a raw colour or size.

Status: rebuilt on 2026-11-16 after the founder rejected the earlier teal design. The palette comes from his reference image (a finance dashboard of rounded cards with mint and lavender blocks and one near-black card). Home, Results (list and map), Provider profile and Saved are laid out in it, in light and dark. Suggest was re-laid-out in it afterwards.

## Direction: Blocks

A near-white page built from big rounded blocks of solid colour. Ink for words and actions, mint for trust, lavender for accent, soft grey for everything that is just a container.

- **Feel:** bright, confident, a little playful. Nothing is outlined; things are blocks.
- **Scene:** a person on an Android phone in daylight, in the street or at home, who needs someone now. Light theme by default with strong contrast; a dark theme follows the system setting.
- **Signature:** the mint Verified mark. A mint pill on cards, a mint disc with a check on map pins, and a whole mint hero block on a verified profile.
- **Refused:** thin grey outlines around boxes, gradients, glass, coloured side stripes, white text on pastel, pastel as a text colour, a list-of-rows look.

## Colour

Each colour has one job.

| Token | Light | Dark | Job |
|---|---|---|---|
| `background` | `#FAFEFF` | `#12131F` | Page ground |
| `surface` | `#FFFFFF` | `#2A2C44` | Insets inside a grey block (the facts strip), the card over the map |
| `surfaceTint` | `#EFF1EE` | `#1D1E32` | Cards, tiles, fields, control tracks |
| `surfaceTintStrong` | `#D0D2CF` | `#3A3C57` | Pressed surfaces, skeletons, the "Not verified" pill |
| `primary` / `onPrimary` | `#1B1C2F` / `#FFFFFF` | `#FAFEFF` / `#1B1C2F` | Primary buttons and the selected state |
| `hero` / `onHero` | `#1B1C2F` / `#FFFFFF` | `#2A2C44` / `#FFFFFF` | The ink block on Home |
| `mint` / `onMint` | `#A4F5A6` / `#1B1C2F` | same | Trust: Verified, "Open now", the search button in the field |
| `accent` / `onAccent` | `#B2A1FF` / `#1B1C2F` | same | Lavender: category blocks, Featured, Sponsored, the search circle |
| `accentSoft` | `#C0C4FF` | same | The block behind a missing photo |
| `accentStrong` | `#6F5BD6` | `#B2A1FF` | The edge of the search circle on the map |
| `text` / `textMuted` / `textSubtle` | `#1B1C2F` / `#55576A` / `#666879` | `#F3F5F4` / `#BBBDCB` / `#9C9EB0` | Text |
| `border` / `outline` | `#D0D2CF` / `#85878F` | `#34364D` / `#7F8198` | Dividers inside a card / control boundaries (3:1) |
| `rating` | `#B97A00` | `#F2BE4A` | Rating stars only |
| `danger` (+ soft pair) | `#B3261E` | `#FFB4AB` | Errors only |
| `whatsapp` | `#25D366` | same | The WhatsApp button only |

Rules:

- Mint and lavender are **fills only**. Text on them is always dark (`onMint`, `onAccent`), in the dark theme too. They are never a text colour and never carry white text.
- Body text meets WCAG AA (4.5:1) on every surface it sits on; control boundaries meet 3:1.
- One shadow in the app: the card that floats over the map (`shadow`).

## Type

Beiruti for titles, Readex Pro for text and controls. Both cover Arabic and Latin. Sizes scale with the system font size.

| Role | Face | Size / line | Use |
|---|---|---|---|
| `display` | Beiruti Bold | 30 / 40 | The question on Home, a provider's name, the Saved and Suggest titles |
| `headline` | Beiruti Bold | 24 / 34 | The wordmark, screen and section titles |
| `title` | Beiruti SemiBold | 19 / 28 | Card names, fact values |
| `body` / `bodyStrong` | Readex Pro 400 / 500 | 15 / 24 | Reading text |
| `action` | Readex Pro 600 | 15 / 22 | Buttons, category tiles |
| `data` | Readex Pro 500 | 14 / 22 | Rating, distance, price |
| `label` | Readex Pro 500 | 13 / 20 | Supporting lines, segments, chips |
| `caption` | Readex Pro 400 | 12 / 18 | Badge pills, map pin names, dates |

## Shape and space

- Radius: `lg` 24 for cards, tiles and blocks; `sheet` 28 for the Home ink block and the profile sheet; `md` 14 for thumbnails and insets; `pill` for buttons, fields, chips and segmented controls.
- Spacing: a 4-point scale. 16 at the page edge, 10 to 12 between blocks, 16 to 20 inside them.
- Touch targets are 48 dp. Compact controls are 36 to 40 dp to the eye and reach 48 with `hitSlop`.
- Motion only marks a state change (120 to 200 ms). No entrance animations.

## Components

- **Button** (`Button.tsx`): one pill, 52 dp. `primary` ink, `whatsapp` green, `tonal` grey, `outline`. `compact` tightens the padding for the three-button action bar.
- **Distance control** (`RadiusChips.tsx`): a grey pill track with four segments, 36 dp high, the chosen one ink. Used in one row on Home and in the Results header.
- **Verified filter** (`VerifiedFilter.tsx`): a pill whose name never changes, "Verified only", with a small switch at its end. On (the default): mint pill, ink track, white thumb at the end with a check. Off: grey pill, mid-grey track, empty thumb at the start. `accessibilityRole="switch"`.
- **List / Map switch** (in `results.tsx`): a grey pill track with two labelled segments (icon and word), the chosen one ink.
- **Category tile** (`CategoryTile.tsx`): a solid block, 112 dp high: icon top, name bottom, an arrow in the corner (chevron opens more choices, diagonal arrow goes to results). Tones: lavender, mint, grey. The grid alternates wide + narrow rows and steps the colours diagonally.
- **Badges** (`Badges.tsx`): pills, 24 dp. Verified (mint, check badge), Not verified (grey, empty badge), Featured (lavender, means paid), Founding member (outlined), and the "Listed by the community" line for a listing nobody has claimed.
- **Open status** (`OpenStatus.tsx`): a mint dot ringed in dark green plus "Open now", or an empty ring plus "Closed". Words are always ink.
- **Provider card** (`ProviderCard.tsx`): a grey block: photo, name, "category · area", the trust line, then a white strip with rating, distance and price in fixed columns. **Sponsored** variant (`sponsored: true`): the block is lavender, with an ink "Sponsored" pill and the sponsor's one-line hook; the API returns it first, so it sits at the top of the list.
- **Map pin** (`MapParts.tsx`): a pill carrying the provider's name (cut at 18 characters) with a pointer under it. Verified: white pill, ink edge, mint check disc. Not verified: grey pill, grey edge, empty ring, muted name. Featured: lavender pill. Selected: ink pill, larger. When names would overlap, only the most important keep their pill (selected, then sponsored and featured, then verified, then by rank; `layoutPins`); the others become a 22 dp dot (mint disc with a check, grey ring when not verified, lavender when featured) drawn under the names. Zooming in or tapping a dot brings its name back. The search position is a lavender dot with an ink ring; the search area is a lavender circle.
- **Story ring** (`StoryRing.tsx`): the mark for "this provider posted an update": a 2.5 dp deep-lavender ring (`accentStrong`) around the photo with a 3 dp gap, keeping the photo's rounded-square shape (never a circle). Ink on a lavender or mint block. Used on Home's "Updates nearby" row (`StoriesRow.tsx`: 68 dp ringed photo or initial, name, time ago), on result cards and in the profile hero.
- **Story viewer** (`app/stories/[providerId].tsx`): full-screen modal on the page ground. Progress segments (grey track, `primary` fill), photo + name + "time ago · category", close. A written update is one lavender (`hero`) block: category icon on a `primary` square at the top, the words at the bottom in `poster` / `display` / `headline` by length. With a photo, the photo fills the block and the words sit on a white block over its lower edge. Under it: a `primary` "View profile" pill and "Hold to pause". Six seconds each; no auto-advance under reduced motion or a screen reader.
- **Offer** (`OfferBlock.tsx`, `OfferTag` in `Badges.tsx`): on a profile, a `primary` block with white words (title, one sentence, "Ends in N days") and the discount as a `poster` figure on a white block (a tag icon when there is no figure). On a card, a `primary` pill with a tag icon and the title; never mint, which stays the trust colour.
- **Sponsored section** (in `results.tsx`): at most two sponsored cards under a "Sponsored / Paid placement" heading, then "All results"; category and everyone searches only, list view only. A sponsored provider outside the section is drawn as a plain card.
- **Follow** (profile): follower count on the start side, a 40 dp `primary` "Follow" pill at the end. It calls `requireSignIn()` (`src/lib/auth.ts`), which for now shows the "Sign-in is coming soon" pill (`SignInNotice.tsx`).
- **State view** (`StateView.tsx`): a lavender disc with the icon and a mint dot; errors use the error colours.

## Screens

- **Home:** wordmark, saved and language. An ink block with the question, the search position and a pill field for search by name (round mint search button). One compact distance row. The category grid. A wide "Everyone nearby" block. Nothing is pinned to the bottom: a tap on a category searches.
- **Results:** one header: back, title and count, List / Map; under it distance and the verified filter. Then the list of blocks, or the map filling everything under the header.
- **Provider profile:** photos, then a hero block (mint when verified, grey when not) with the name and the verification line; three fact blocks; opening hours, about and reviews as grey cards; an action bar with WhatsApp, Call and Directions.
- **Saved:** a big title and one grey block per saved provider.
- **Suggest:** a back arrow; a lavender block with the icon, the title and one sentence; then the questions as grey pill fields (52 dp, the note is a block), labels set in to line up with the typed text, the edge turning ink on focus and red on an error; the ink button stays docked above the keyboard.

## Right-to-left

Arabic mirrors every row through the `row`, `start` and `end` helpers in `src/i18n`. Arrows flip; phone numbers and counts stay left-to-right. Names and prices take their direction from their own text.

## What is verified

Checked in the web build at 390 x 844 (screenshots in `design-preview/`): Home in English, Arabic and dark; Results with unverified included; the map preview; a verified profile. Not yet checked on an Android device: the native map (pin labels, height), font scaling at large sizes, and the dark theme beyond Home.
