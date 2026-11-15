# Home screen: three design options

Three bright looks for the Home screen, to pick one. Only Home is designed; Results and Profile take the new colours but are not restyled yet. All three are light only for now (the dark theme returns once one is chosen).

Screenshots are in this folder: `a-home-en.png`, `a-home-ar.png`, `b-home-en.png`, `b-home-ar.png`, `c-home-en.png`, `c-home-ar.png` (390 x 844, 2x, mock data).

## How to switch

Set the variable before starting Expo, then restart with a clean cache:

```bash
EXPO_PUBLIC_DESIGN_VARIANT=b npx expo start --clear     # a, b or c; default a
```

In PowerShell: `$env:EXPO_PUBLIC_DESIGN_VARIANT = 'b'; npx expo start --clear`

On web only, `?variant=b` in the address also works without a restart.

The options live in `src/theme/tokens.ts` (`variants`) and are picked in `src/theme/index.tsx`.

## A. Dekkaneh (warm)

The corner shop under a sunny awning. A peach header with a yellow sun in the corner, a checkerboard of peach and butter tiles with the icon in a white circle, and one hot vermilion for the name, the chosen chip and the search button.

| Role | Hex |
|---|---|
| Ground | `#FFFFFF` |
| Header wash | `#FFF1E7` |
| Primary (vermilion) | `#D9361A` (pressed `#B52A12`) |
| Accent (sun) | `#FFC233` |
| Text | `#2A1610` |
| Muted text | `#6B4A40` |
| Tile, peach | `#FFE7D6`, icon `#D9361A` |
| Tile, butter | `#FFEFAE`, icon `#9A5B00` |
| Outline / hairline | `#AD8172` / `#F3DDD0` |

Chosen tile: filled vermilion, white label, yellow tick. Shapes: round (22 dp tiles, pill chips and button).

Trade-off: the friendliest and most "local" of the three, but red is also the colour of errors and of food-delivery apps, so the error red has to stay rare and darker. The soft tiles are the calmest of the three options.

## B. Corniche (fresh)

Sea and white. A plain white header, the location in an aqua pill with one coral "you are here" dot, and a two-column list of white tiles, each with a solid teal square holding a white icon. The distance choice is one segmented bar.

| Role | Hex |
|---|---|
| Ground | `#FFFFFF` |
| Aqua wash (pill, chip track) | `#E6F7FA` |
| Primary (sea teal) | `#00708A` (pressed `#005A70`) |
| Accent (coral) | `#FF6A4D` |
| Text | `#0C2A33` |
| Muted text | `#45636C` |
| Tile | `#FFFFFF`, border `#C9EBF1`, icon square `#00708A`, icon `#FFFFFF` |
| Outline / hairline | `#6A96A1` / `#D5ECF1` |

Chosen tile: filled teal, white label, coral tick. Shapes: medium (16 dp tiles and button).

Trade-off: the most trustworthy and the easiest to read (labels sit beside the icon, so long Arabic and English names never crowd), and it extends most easily to Results and Profile. It is also the quietest: one hue plus a small coral point, so it is the closest of the three to a "clean app" look.

## C. Balat (bold, many colours)

Beirut's patterned cement floor tiles. A white page where the colour is the grid itself: solid cobalt, sun yellow, tomato, emerald and pink tiles with the icon at the top and a bold label at the bottom. One indigo-black holds it together (text, chosen chip, search button), and the name sits on a yellow sticker.

| Role | Hex |
|---|---|
| Ground | `#FFFFFF` |
| Primary (indigo-black) | `#17153B` (pressed `#2C2A5C`) |
| Accent (sticker yellow) | `#FFD12E` |
| Text | `#17153B` |
| Muted text | `#55536F` |
| Tile, cobalt | `#2D4FE0`, white label |
| Tile, sun | `#FFC629`, label `#2B1D00` |
| Tile, tomato | `#D4330F`, white label |
| Tile, emerald | `#087F4E`, white label |
| Tile, pink | `#D61F69`, white label |
| Outline / hairline | `#8D8BA3` / `#E6E5EF` |

Chosen tile: keeps its colour inside a dark ring, with a dark tick. Shapes: 20 dp tiles, 18 dp button.

Trade-off: the most energetic and the most recognisable; nobody will call it sleepy. It is also the hardest to carry to the other screens: the tile colours are handed out by position, not by meaning, and Results and Profile will need to stay mostly white and indigo so the provider photos, stars and badges are not fighting five colours.

## Checked for all three

- Text contrast is WCAG AA: every label and body text is at least 4.5:1 on its own background (lowest: white on vermilion 4.67, white on tomato 4.91, white on pink 4.93, white on emerald 5.05). Control outlines are at least 3:1.
- Touch targets are 48 dp or more: tiles 66 to 98 dp, chips 48 dp, search button 56 dp, language switch 48 dp.
- Arabic right-to-left is mirrored (see the `-ar` screenshots).
- WhatsApp green is not used on Home; it stays on the WhatsApp button only.
- All twelve categories fit on one 390 x 844 screen without scrolling.

## Known limits

- Tiles that open a second level look the same as tiles that select directly (this was already so).
- On phones narrower than 360 dp, a long single word such as "Dermatologist" is shrunk slightly on Android to stay on one line; on web it may still wrap.
- Results and Profile are untouched in layout. They pick up the new colours through the same token names and will be redesigned after the choice.
- `DESIGN.md` still describes the old look. It is rewritten after the choice.
