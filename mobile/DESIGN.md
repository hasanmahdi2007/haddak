# Haddak design system

The visual rules for the Haddak app. The code mirror of this file is `src/theme/tokens.ts`: change both together. Screens and components use tokens only, never a raw colour or size.

Status: first direction, built for tasks M1 to M3. **Not yet approved by the founder (task M4).**

## Direction: stamped paperwork

In Lebanon a thing is true once it carries the stamp: the mukhtar's round ink seal on a paper, the fiscal stamp on a form. Haddak's promise is that every provider was checked by hand, so verification is drawn as that stamp and is the first thing seen on every provider.

- **Feel:** an official paper you trust, handled by someone friendly. Flat, clear, a little formal, never corporate.
- **Scene:** a person on an Android phone in daylight, in the street or at home, who needs someone now. So the default is a light theme with strong contrast. A dark theme follows the system setting.
- **Refused:** the delivery-app look (gradient hero, promo carousel, floating shadowed cards), purple or blue gradients, emoji as icons, glass effects, cards inside cards.
- **Signature:** the verified seal (see Badges). It is the one decorative gesture; nothing else is ornamental.

How the direction was picked is recorded in `.impeccable/surfaces/src-app-index-tsx.md`.

## Colour

Four inks, one meaning each. An ink is never borrowed for decoration.

| Ink | Meaning | Where |
|---|---|---|
| Ink blue | Trust and action | Header, primary button, selected chip, icons on tiles, the verified seal |
| Saffron | Merit | Rating stars, the Featured label |
| Cedar green | Founding member | The founding-member stamp only |
| Carmine | Something went wrong | Error notices only |

WhatsApp green belongs to WhatsApp and appears only on the WhatsApp button.

### Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#F4F1EA` | `#111325` | Page ground |
| `sheet` | `#FFFFFF` | `#1A1D33` | Cards, docked bars |
| `manila` | `#EAE3D2` | `#272B47` | Category tiles, photo placeholders, pressed surfaces |
| `manilaDeep` | `#DDD4BE` | `#343959` | Pressed tiles, skeleton blocks |
| `ink` | `#24338F` | `#B4BDFF` | Primary colour |
| `inkPressed` | `#1B2770` | `#9AA5F5` | Pressed primary |
| `onInk` | `#FFFFFF` | `#121A55` | Text on ink |
| `inkWash` | `#E2E6F8` | `#2B3170` | Selected tile, Call button, active view toggle |
| `onInkWash` | `#1B2770` | `#DDE1FF` | Text on ink wash |
| `shell` | `#24338F` | `#1B2260` | Home header |
| `onShell` | `#FFFFFF` | `#FFFFFF` | Text on the header |
| `onShellMuted` | `#CDD3F4` | `#C3CAF5` | Secondary text on the header |
| `shellLine` | `#8F99DC` | `#7E88CC` | Outlines on the header |
| `text` | `#17192B` | `#ECEDF7` | Main text |
| `textMuted` | `#4A4E63` | `#BDC0D4` | Supporting text |
| `textSubtle` | `#5C6074` | `#A1A5BD` | Captions, quiet icons |
| `hairline` | `#DAD4C5` | `#2E3252` | Dividers, card edges |
| `outline` | `#8A8473` | `#7F84A6` | Control borders |
| `saffron` | `#C48600` | `#F2BE4A` | Stars |
| `saffronWash` / `onSaffronWash` | `#FBE7B0` / `#553B00` | `#4A3A10` / `#FBE3A6` | Featured label |
| `cedar` | `#1F6B4C` | `#7FCFA6` | Founding stamp border |
| `cedarWash` / `onCedarWash` | `#DCEDE2` / `#154D36` | `#173D2D` / `#BFE8D2` | Founding stamp |
| `carmine` | `#B3261E` | `#FFB4AB` | Error accents |
| `carmineWash` / `onCarmineWash` | `#FBE4E1` / `#7A1410` | `#5C1612` / `#FFDAD5` | Error notice |
| `whatsapp` / `onWhatsapp` | `#25D366` / `#062E17` | same | WhatsApp button |
| `scrim` / `onScrim` | `rgba(23,25,43,.62)` / `#FFFFFF` | `rgba(10,11,24,.66)` / `#FFFFFF` | Controls over photos |

### Contrast (light theme, measured)

| Pair | Ratio | Needs |
|---|---|---|
| `text` on `paper` / `sheet` / `manila` | 15.4 / 17.4 / 13.6 | 4.5 |
| `textMuted` on `paper` / `sheet` | 7.3 / 8.2 | 4.5 |
| `textSubtle` on `paper` / `sheet` / `manila` | 5.5 / 6.2 / 4.9 | 4.5 |
| `onInk` on `ink`, `onShell` on `shell` | 10.8 | 4.5 |
| `onShellMuted` on `shell` | 7.3 | 4.5 |
| `onInkWash` on `inkWash` | 10.8 | 4.5 |
| `ink` on `manila` (tile icons) | 8.4 | 3 |
| `onSaffronWash` on `saffronWash` | 8.5 | 4.5 |
| `onCedarWash` on `cedarWash` | 8.0 | 4.5 |
| `onCarmineWash` on `carmineWash` | 8.9 | 4.5 |
| `onWhatsapp` on `whatsapp` | 7.5 | 4.5 |
| `outline` on `paper` / `sheet` | 3.3 / 3.7 | 3 |
| `shellLine` on `shell` | 4.0 | 3 |
| `saffron` on `sheet` (star) | 3.1 | 3 |

White text on WhatsApp green fails (2:1), so the WhatsApp button uses dark green text. Dark theme pairs all measure above 4.5 for text and 3 for graphics.

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
| `headline` | Beiruti 700 | 24 / 34 | Screen titles, provider name |
| `title` | Beiruti 600 | 19 / 28 | Card names, section titles |
| `body` | Readex Pro 400 | 15 / 24 | Reading text |
| `bodyStrong` | Readex Pro 500 | 15 / 24 | Emphasis in text |
| `action` | Readex Pro 600 | 15 / 22 | Buttons, chips |
| `data` | Readex Pro 500 | 14 / 22 | Rating, distance, price on cards |
| `label` | Readex Pro 500 | 13 / 20 | Supporting lines, tile labels |
| `caption` | Readex Pro 400 | 12 / 18 | Badge labels, dates |

Rules: sizes scale with the system font size (never turn scaling off, except the decorative word in the seal). No letter-spacing, which breaks Arabic joining. No all-caps. Line heights are generous enough for Arabic marks. Digits stay Western (1, 2, 3) in both languages, as on Lebanese price lists and phone numbers.

All text goes through `components/Txt.tsx`, which applies the role, the colour token and the reading direction.

## Spacing, shape, depth

- **Spacing** (4-point scale): `xxs` 2, `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `xxl` 24, `xxxl` 32, `huge` 48. Screen side padding is `lg`. Related things sit `xs` to `sm` apart; sections sit `xxl` apart.
- **Radius**: `sm` 6 (tags, stamps, thumbnails), `md` 10 (tiles, cards), `lg` 14 (buttons), `pill` (chips, round buttons).
- **Depth**: none. No drop shadows. A sheet is told from the paper by its white fill and a 1 dp `hairline` edge; docked bars by a top hairline.
- **Sizes**: touch target 48 dp minimum, button height 52, chip 40 visible inside a 48 target, icons 16 / 20 / 24 with a 1.75 stroke, category tile at least 104 high, card thumbnail 84, seal 22 small and 96 large, content column at most 560 wide.
- **Motion**: only to mark a state change. 120 ms press, 200 ms image fade, a slow skeleton pulse that stops when Reduce Motion is on. No entrance animations.

## Icons

Lucide line icons (`lucide-react-native`), one stroke weight, coloured with tokens. No emoji, no mixed icon sets. Category icons are keyed by the API's `icon` field in `components/CategoryIcon.tsx`; an unknown key falls back to a shop icon. Arrows flip in Arabic.

## Components

### Category tile (`CategoryTile`)
Manila tile, radius `md`, ink line icon above a centred `label` (two lines at most), three per row with `sm` gaps. Selected: `inkWash` fill, 2 dp `ink` border, check mark in the top start corner. A parent whose child is selected shows as selected with the child's name beneath. Tapping a parent opens its children in place, with a back arrow and an "All …" tile first.

### Radius chips (`RadiusChips`)
Four equal pills in a row: 500 m, 1 km, 5 km, City. One is always selected (default 1 km): `ink` fill, `onInk` text. Others: `sheet` fill, `outline` border. Announced as a radio group.

### Buttons (`Button`, `IconButton`)
One shape: 52 dp high, radius `lg`, `action` type, optional leading icon.

| Variant | Fill / text | Use |
|---|---|---|
| `primary` | `ink` / `onInk` | The main action of a screen (Search, Try again) |
| `whatsapp` | `whatsapp` / `onWhatsapp` | WhatsApp only |
| `tonal` | `inkWash` / `onInkWash` | Call |
| `outline` | clear, `outline` border, `ink` text | Secondary actions (Show more reviews) |

One primary per screen. On the profile the WhatsApp button is wider than Call (1.6 to 1) because most contact in Lebanon starts on WhatsApp. Icon buttons are 48 dp circles; over a photo they take a `scrim` fill.

### Provider card (`ProviderCard`)
A sheet with a hairline edge. Top: 84 dp thumbnail, then the name (`title`) with the small seal right after it, "category · area" (`label`, muted), then tags if any. Bottom row, above a hairline: **rating, distance, price in the same three columns on every card** (5 : 4 : 8), so a list is compared by running the eye down a column. A missing price leaves its column empty. No photo: the category icon on manila.

### Badges (`Badges.tsx`)
- **Verified seal**: a round double-ring ink stamp, turned 9 degrees like a stamp pressed by hand. Large (96 dp, on the profile, overlapping the bottom edge of the photo on the end side): white disc, two ink rings, the word موثّق in ruqaa and a check. It is always in Arabic, as a real stamp would be; the text label beside the name translates it. Small (22 dp, beside a name): ink ring around a solid ink disc with a white check.
- **Founding member**: a small fiscal stamp. `cedarWash` fill, dashed `cedar` border (the perforation), award icon, `caption` text.
- **Featured**: `saffronWash` tag with `caption` text. Featured is paid placement: the screen-reader label says so, and it must never be styled to look like a quality award.

### Rating (`Rating`, `Stars`)
On cards: saffron star, the average to one decimal, the count in brackets. No reviews: the word "New" instead of a zero. In reviews: five small stars, filled or outlined.

### WhatsApp and Call
Docked at the bottom of the profile on a sheet with a top hairline, always visible. They open `wa.me` and `tel:` links. If a link cannot open, a carmine notice appears above the buttons with the reason and what to do.

### States (`StateView`, `Skeleton`)
- **Loading**: skeleton blocks in the shape of the content (tiles, cards, profile), never a centred spinner.
- **Empty**: a quiet line icon, a title that says what happened ("No one within 500 m yet"), one sentence, and one button that fixes it (search the next distance).
- **Error**: same layout, announced as an alert, with "Try again".
- **No photo**: category icon on manila; the profile header is shorter.
- **Map**: placeholder state until task M5.

## Right-to-left

Arabic is a first-class layout, not a mirrored afterthought.

- The app controls direction itself (`src/i18n/index.tsx`), so the language switch flips the layout at once, with no restart, on Android, iOS and web.
- Rows use `row` from `useI18n()`; never write `flexDirection: 'row'` in a screen. Use `gap` for spacing. Do not use `marginLeft/Right`, `paddingStart/End` or `borderStart/End`; for absolute positions use `start(n)` / `end(n)`.
- Text aligns to the reading edge through `Txt`. Text typed by providers and reviewers (names, prices, descriptions, comments) may be in either language, so `Txt content` takes its direction from the text itself.
- Back arrows flip. The seal, stars, check marks, logos and phone numbers do not.
- Known gap: the photo gallery always swipes left to right.

## Voice

Plain, warm, local. English is short and direct. Arabic is light Lebanese ("مين بدّك حدّك؟"), not formal translation. Buttons say what they do ("Search in Laptop repair"). Errors say what happened and what to do next. All strings live in `src/i18n/en.ts` and `src/i18n/ar.ts`.
