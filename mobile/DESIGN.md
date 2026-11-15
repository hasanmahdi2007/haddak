# Haddak design system

The visual rules for the Haddak app, as built. The code mirror of this file is `src/theme/tokens.ts`: change both together. Screens and components use tokens only, never a raw colour or size.

Status: the founder chose this direction (option B, "Corniche") on 2026-11-15. Home, Results and Provider profile are built in it, in light and dark. Screenshots are in `design-preview/` (web build, see "What is verified" at the end).

## Direction: Corniche

Sea and white. A pure white page, one sea teal for the brand and every action, pale aqua surfaces where things group together, and a single coral point that says "you are here".

- **Feel:** bright, crisp and awake. Trust comes from clarity: a clean page, a teal seal, plain facts.
- **Scene:** a person on an Android phone in daylight, in the street or at home, who needs someone now. So the default is a light theme with strong contrast. A dark theme follows the system setting.
- **Refused:** beige or grey grounds, navy headers, gradients, drop shadows, glass effects, emoji as icons, cards inside cards, promo carousels. Nothing that looks sleepy, and nothing that looks like a template.
- **Signature:** the verified seal (see Badges). It is the one decorative gesture; nothing else is ornamental.

## Colour

Each colour has one job and is never borrowed for decoration.

| Colour | Job | Where |
|---|---|---|
| Sea teal | The brand, actions, verification | Wordmark, primary buttons, selected chip, tile icon squares, the seal, fact icons |
| Aqua | Grouping | Location pill, chip track, facts strips, photo placeholders, skeletons |
| Coral | "Here" | The location pin, the tick on a chosen tile, the dot on an empty state. Never text on white |
| Amber | Ratings and Featured | Stars, the Featured tag |
| Green | Founding member | The founding-member tag only |
| Red | Something went wrong | Error states and notices only |
| WhatsApp green | WhatsApp | The WhatsApp button only |

### Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FFFFFF` | `#061A20` | Page ground |
| `surface` | `#FFFFFF` | `#0B252D` | Cards, tiles, docked bars |
| `surfaceTint` | `#E6F7FA` | `#11343F` | Aqua surfaces: location pill, chip track, facts strips, photo placeholders, pressed cards |
| `surfaceTintStrong` | `#C9EBF1` | `#1A4856` | Tile and card edges, pressed chips, skeleton blocks, dividers on aqua |
| `primary` | `#00708A` | `#4CC2DB` | Sea teal |
| `primaryPressed` | `#005A70` | `#7AD3E6` | Pressed primary |
| `onPrimary` | `#FFFFFF` | `#00232C` | Text and icons on teal |
| `primarySoft` / `onPrimarySoft` | `#D3F1F6` / `#004E61` | `#104452` / `#C2EDF6` | Soft teal fill; the dark teal is also the "Use my location" link |
| `text` | `#0C2A33` | `#E9F6F9` | Main text |
| `textMuted` | `#45636C` | `#AECAD1` | Supporting text |
| `textSubtle` | `#52707A` | `#93B3BC` | Captions, review counts, dates |
| `border` | `#D5ECF1` | `#1C3E49` | Dividers, header and dock lines |
| `outline` | `#6A96A1` | `#6C96A1` | Control borders (language switch, outline button), empty stars |
| `rating` | `#B97A00` | `#F2BE4A` | Stars |
| `ratingSoft` / `onRatingSoft` | `#FFEFC2` / `#553B00` | `#4A3A10` / `#FBE3A6` | Featured tag |
| `success` | `#1F6B4C` | `#7FCFA6` | Founding member (reserved) |
| `successSoft` / `onSuccessSoft` | `#DCEDE2` / `#154D36` | `#173D2D` / `#BFE8D2` | Founding-member tag |
| `danger` | `#B3261E` | `#FFB4AB` | Errors (reserved) |
| `dangerSoft` / `onDangerSoft` | `#FBE4E1` / `#7A1410` | `#5C1612` / `#FFDAD5` | Error disc, error notice |
| `whatsapp` / `whatsappPressed` / `onWhatsapp` | `#25D366` / `#1EB958` / `#062E17` | same | WhatsApp button |
| `scrim` / `onScrim` | `rgba(12,42,51,.72)` / `#FFFFFF` | `rgba(3,14,18,.72)` / `#FFFFFF` | Controls over photos |
| `accent` / `onAccent` | `#FF6A4D` / `#4A1206` | `#FF7A5F` / `#3A0D03` | The coral point |

The dark theme is the same sea at night: a deep blue-green ground, slightly lighter surfaces, and a lighter teal so buttons and the seal keep their contrast. On teal, text turns dark in the dark theme.

### Contrast (measured)

| Pair | Light | Dark | Needs |
|---|---|---|---|
| `text` on `background` / `surfaceTint` | 15.1 / 13.7 | 16.2 / 12.0 | 4.5 |
| `textMuted` on `background` / `surfaceTint` | 6.5 / 5.9 | 10.3 / 7.7 | 4.5 |
| `textSubtle` on `background` / `surfaceTint` | 5.3 / 4.8 | 8.0 / 5.9 | 4.5 |
| `primary` (as text or icon) on `background` / `surfaceTint` | 5.7 / 5.2 | 8.5 / 6.3 | 4.5 |
| `onPrimary` on `primary` | 5.7 | 7.9 | 4.5 |
| `onPrimarySoft` on `surfaceTint` | 8.4 | 10.6 | 4.5 |
| `onRatingSoft` on `ratingSoft` | 9.1 | 8.7 | 4.5 |
| `onSuccessSoft` on `successSoft` | 8.0 | 9.0 | 4.5 |
| `onDangerSoft` on `dangerSoft` | 8.9 | 10.3 | 4.5 |
| `onWhatsapp` on `whatsapp` | 7.5 | 7.5 | 4.5 |
| `onAccent` on `accent` | 5.4 | 6.6 | 4.5 |
| `outline` on `background` | 3.2 | 5.5 | 3 |
| `rating` (star) on `background` / `surfaceTint` | 3.6 / 3.3 | 10.4 / 7.7 | 3 |
| `onScrim` on `scrim` over a white photo | 6.1 | higher | 4.5 |

Known and accepted: tile and card edges (`surfaceTintStrong`) are about 1.3:1 against the page. They are not what identifies the control: a tile is read by its solid teal icon square and label, a card by its photo and aqua strip. White text on WhatsApp green fails (2:1), so that button uses dark green text.

## Typography

Arabic and Latin are equals, so every face was chosen because one designer drew both scripts together.

| Face | Role | Why |
|---|---|---|
| **Beiruti** (Boutros Fonts, a Lebanese foundry) | Titles | Named for Beirut; firm, slightly condensed, with character in both scripts |
| **Readex Pro** (Arabic by Nadine Chahine) | Text, buttons, numbers | Wide, open letterforms that stay clear at small sizes |
| **Aref Ruqaa** | Only the word inside the large seal | Ruqaa is the script of Lebanese stamps and handwriting |

Loaded with `@expo-google-fonts/*` in `src/app/_layout.tsx`.

| Role | Face and weight | Size / line | Use |
|---|---|---|---|
| `display` | Beiruti 700 | 30 / 40 | The question on Home |
| `headline` | Beiruti 700 | 24 / 34 | Wordmark, screen titles, provider name, state titles |
| `title` | Beiruti 600 | 19 / 28 | Card names, section titles, profile facts |
| `body` | Readex Pro 400 | 15 / 24 | Reading text |
| `bodyStrong` | Readex Pro 500 | 15 / 24 | Emphasis, review authors, "Verified" on the profile |
| `action` | Readex Pro 600 | 15 / 22 | Buttons, chips |
| `data` | Readex Pro 500 | 14 / 22 | Rating, distance, price on cards |
| `label` | Readex Pro 500 | 13 / 20 | Supporting lines, tile labels |
| `caption` | Readex Pro 400 | 12 / 18 | Tag labels, dates, fact labels |

Rules: sizes scale with the system font size (never turn scaling off, except the decorative word in the seal). No letter-spacing, which breaks Arabic joining. No all-caps. Line heights are generous enough for Arabic marks. Digits stay Western (1, 2, 3) in both languages, as on Lebanese price lists and phone numbers.

All text goes through `components/Txt.tsx`, which applies the role, the colour token and the reading direction.

## Spacing, shape, depth

- **Spacing** (4-point scale): `xxs` 2, `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `xxl` 24, `xxxl` 32, `huge` 48. Screen side padding is `lg`. Related things sit `xs` to `sm` apart; cards sit `md` apart; sections sit `xxl` apart.
- **Radius**: `sm` 8 (tags), `md` 12 (chips, thumbnails, tile icon squares), `lg` 16 (tiles, cards, buttons, tracks, facts strips), `sheet` 24 (top corners of the profile sheet), `pill` (round buttons, the location pill, the language switch).
- **Depth**: none. No drop shadows. Things are told apart by white against aqua, a 1.5 dp aqua edge, or a 1 dp `border` line under a header and over a dock.
- **Sizes**: touch target 48 dp minimum, button 56 high, chips 48 high, view-toggle segment 48 x 40 (48 with its touch slop), icons 16 / 20 / 24 with a 1.75 stroke, category tile at least 66 high with a 44 icon square, card thumbnail 88, seal 22 small and 92 large, state disc 88, content column at most 560 wide.
- **Motion**: only to mark a state change. A press changes colour or opacity at once, images fade in over 200 ms, skeletons pulse slowly and stop when Reduce Motion is on. No entrance animations.

## Icons

Lucide line icons (`lucide-react-native`), one stroke weight, coloured with tokens. No emoji, no mixed icon sets. Category icons are keyed by the API's `icon` field in `components/CategoryIcon.tsx`; an unknown key falls back to a shop icon. Arrows flip in Arabic.

## Screens

- **Home** (`src/app/index.tsx`): teal wordmark and the language switch; the question; the aqua location pill with the coral pin; a two-column grid of category tiles; a docked bar with the distance track and one full-width search button whose label names the chosen category.
- **Results** (`src/app/results.tsx`): back arrow, title (the category, or "Everyone nearby") with the result count under it, the list / map toggle, then the same distance track as Home. Below, a list of provider cards.
- **Provider profile** (`src/app/provider/[id].tsx`): photo gallery at the top; a white sheet with 24 dp top corners rises 24 dp over it, with the large seal across that edge on the end side. Then "category · area", the name, the verified line, tags, the facts strip, About, Reviews. WhatsApp and Call are docked at the bottom.

## Components

### Category tile (`CategoryTile`)
White tile, radius `lg`, 1.5 dp `surfaceTintStrong` edge. A solid teal 44 dp square (radius `md`) holds a white line icon; the `label` sits beside it (two lines at most). Two per row with `sm` gaps.
- **Pressed:** 72% opacity.
- **Selected:** teal fill, white label, the icon square turns white with a teal icon, and a coral tick appears at the end. A parent whose child is selected shows as selected with the child's name beneath.
- Tapping a parent opens its children in place, with a back arrow and an "All …" tile first.

### Distance track (`RadiusChips`)
One aqua track (radius `lg`, 4 dp padding) with four equal segments: 500 m, 1 km, 5 km, City. One is always selected (default 1 km): teal fill, `onPrimary` text. Others: no fill, `text` colour; pressed: `surfaceTintStrong`. Announced as a radio group.

### View toggle (in `results.tsx`)
A small version of the same track with two icon segments, list and map. Active: teal fill, `onPrimary` icon. Announced as tabs with the labels "List" and "Map".

### Buttons (`Button`, `IconButton`)
One shape: 56 dp high, radius `lg`, `action` type, optional leading icon.

| Variant | Fill / text | Use |
|---|---|---|
| `primary` | `primary` / `onPrimary` | Search, Call, the action of an empty or error state |
| `whatsapp` | `whatsapp` / `onWhatsapp` | WhatsApp only |
| `outline` | clear, 1.5 dp `outline` border, `primary` text | Secondary actions (Show more reviews, Back to the list) |
| `tonal` | `surfaceTint` / `onPrimarySoft` | Available, not used on a screen yet |

States: pressed swaps to the pressed colour; disabled is 45% opacity; loading shows a spinner in place of the label. Icon buttons are 48 dp circles; over a photo they take a `scrim` fill and a white icon.

### Provider card (`ProviderCard`)
White card, radius `lg`, 1.5 dp `surfaceTintStrong` edge, in two parts.
- **Top:** 88 dp photo (radius `md`), then the name (`title`, two lines at most), "category · area" (`label`, muted), then the badges in one wrapping row: Verified, Featured, Founding member.
- **Bottom:** an aqua strip with **rating, distance, price in the same three columns on every card** (5 : 4 : 8), so a list is compared by running the eye down a column. A long price wraps to a second line; a missing price leaves its column empty.
- **No photo:** the category icon in teal on aqua.
- **Featured:** the card's edge is teal instead of aqua, and it carries the Featured tag. That is all: no fill, no ribbon, no larger size.
- **Pressed:** the top turns aqua.
- The whole card is one button with one spoken description (name, place, badges, rating, distance, price).

### Badges (`Badges.tsx`)
- **Verified seal**: Haddak's trust mark, always teal, always the same double ring. *Small* (22 dp): a teal ring around a solid teal disc with a white check; it never appears without the word "Verified" beside it. *Large* (92 dp, profile only): a white disc with two teal rings, the word موثّق in ruqaa and a check, turned 8 degrees like a stamp pressed by hand. The word is always in Arabic, as a real stamp would be; the verified line translates it.
- **Verified badge**: small seal + "Verified" in teal. On cards. On the profile it becomes the verified line: the seal, "Verified", and under it the sentence that says what Haddak checked.
- **Founding member**: `successSoft` tag, medal icon, `caption` text.
- **Featured**: `ratingSoft` tag with `caption` text and no icon. Featured is paid placement: the screen-reader label says so, and it must never be styled to look like a quality award.

### Rating (`Rating`, `Stars`)
On cards and in the profile facts: amber star, the average to one decimal, the count in brackets (cards). No reviews: the word "New" instead of a zero. In reviews: five small stars, filled amber or outlined.

### Profile facts strip
One aqua strip (radius `lg`) with three columns split by thin lines: rating, distance, price. Each shows its icon and value in `title` type with a `caption` label under it. Same icons and order as the card strip.

### Photo (`Photo`)
A provider photo, cropped to fill. No photo, or it fails to load: the category icon in teal on aqua. On the profile the header is shorter when there are no photos. A gallery with several photos shows a "1 / 3" counter on a scrim pill.

### WhatsApp and Call
Docked at the bottom of the profile on `surface` with a top `border` line, always visible. WhatsApp is green and wider (1.6 to 1) because most contact in Lebanon starts there; Call is teal. They open `wa.me` and `tel:` links. If a link cannot open, a `dangerSoft` notice appears above the buttons with the reason and what to do, and can be dismissed.

### States (`StateView`, `Skeleton`)
- **Loading**: aqua skeleton blocks (`surfaceTintStrong`) in the shape of the content: tiles, cards with their aqua strip, the profile. Never a centred spinner.
- **Empty**: an 88 dp aqua disc with a teal icon and the coral dot at its top end corner; a `headline` title that says what happened ("No one within 500 m yet"), one sentence, and one button that fixes it (search the next distance).
- **Error**: the same layout in error colours (`dangerSoft` disc, dark red icon, no coral dot), announced as an alert, with "Try again".
- **Map**: the empty layout with an outline button, until the map is built.

## Right-to-left

Arabic is a first-class layout, not a mirrored afterthought.

- The app controls direction itself (`src/i18n/index.tsx`), so the language switch flips the layout at once, with no restart, on Android, iOS and web.
- Rows use `row` from `useI18n()`; never write `flexDirection: 'row'` in a screen. Use `gap` for spacing. Do not use `marginLeft/Right`, `paddingStart/End` or `borderStart/End`; for absolute positions use `start(n)` / `end(n)`.
- Text aligns to the reading edge through `Txt`. Text typed by providers and reviewers (names, prices, descriptions, comments) may be in either language, so `Txt content` takes its direction from the text itself.
- Back arrows flip. The seal, stars, check marks, logos and phone numbers do not. The large seal moves to the other side of the profile; the photo counter moves opposite it.
- Known gap: the photo gallery always swipes left to right.

## Accessibility

- **Contrast:** text is at least 4.5:1 and icons and control borders at least 3:1 on their own background, in both themes (table above). New colour pairs must be measured before use.
- **Touch targets:** 48 dp minimum. Where the visible shape is smaller (view toggle, notice close), `hitSlop` makes up the difference.
- **Screen readers:** every control has a role and a label. Icon-only buttons always pass `label`. A provider card is one button with one description. Featured is announced as "Featured, paid placement". The large seal is decorative and hidden; the verified line carries the words. Loading blocks are announced as "Loading results" / "Loading profile"; errors are alerts; the result count and the location line are live regions.
- **Colour is never the only signal:** a selected tile also gets a tick, selected chips and tabs also set their selected state, a featured card also has its tag, errors also have an icon and words.
- **Text size:** all text follows the system font size.
- **Motion:** the skeleton pulse stops when Reduce Motion is on.

## Voice

Plain, warm, local. English is short and direct. Arabic is light Lebanese ("مين بدّك حدّك؟"), not formal translation. Buttons say what they do ("Search in Laptop repair"). Errors say what happened and what to do next. All strings live in `src/i18n/en.ts` and `src/i18n/ar.ts`.

## What is verified

- Checked in the web build at 390 x 844 in English and Arabic, light and dark (`design-preview/`).
- Not yet checked on an Android device: ripple colours, status bar, behaviour at large system font sizes, and TalkBack reading order.
