# Haddak design system

The visual rules for the Haddak app, as built. The code mirror of this file is `src/theme/tokens.ts`: change both together. Screens and components use tokens only, never a raw colour or size.

Status: rebuilt on 2026-11-16 after the founder rejected the earlier teal design. The palette comes from his reference image (a finance dashboard of rounded cards with mint and lavender blocks and one near-black card). Home, Results (list and map), Provider profile and Saved are laid out in it, in light and dark. Suggest was re-laid-out in it afterwards.

## Direction: Blocks

A pale lavender page built from big rounded blocks of solid colour. Ink for words, purple (`primary`) for actions and the selected state, mint for trust, lavender for accent, a lavender-grey for everything that is just a container.

- **Feel:** bright, confident, a little playful. Nothing is outlined; things are blocks.
- **Scene:** a person on an Android phone in daylight, in the street or at home, who needs someone now. Light theme by default with strong contrast; a dark theme follows the system setting.
- **Signature:** the mint Verified mark. A mint pill on cards, a mint disc with a check on map pins, and a whole mint hero block on a verified profile.
- **Refused:** thin grey outlines around boxes, gradients, glass, coloured side stripes, white text on pastel, pastel as a text colour, a list-of-rows look.

## Colour

Each colour has one job. This table matches `src/theme/tokens.ts` value for value (checked 2026-11-16).

| Token | Light | Dark | Job |
|---|---|---|---|
| `background` | `#E5E1F5` | `#12131F` | Page ground (pale lavender in light) |
| `surface` | `#FAF9FE` | `#2A2C44` | White blocks: sections, insets (the facts strip), the card over the map |
| `surfaceTint` | `#D7D2EE` | `#1D1E32` | Cards, tiles, fields, control tracks |
| `surfaceTintStrong` | `#C2BCE0` | `#3A3C57` | Pressed surfaces, skeletons, the "Not verified" pill |
| `primary` / `primaryPressed` / `onPrimary` | `#6F5BD6` / `#5B48BF` / `#FFFFFF` | `#FAFEFF` / `#D0D2CF` / `#1B1C2F` | Primary buttons, the selected state, applied filters |
| `onPrimarySoft` | `#1B1C2F` | `#FAFEFF` | Text and icons of a quiet action on a grey surface |
| `hero` / `onHero` / `onHeroMuted` | `#B2A1FF` / `#1B1C2F` / `#2F3046` | `#2A2C44` / `#FFFFFF` / `#C9CBDA` | The lavender block on Home |
| `mint` / `onMint` | `#A4F5A6` / `#1B1C2F` | same | Trust and positive marks: Verified, "Open now", "Available now" |
| `accent` / `onAccent` | `#B2A1FF` / `#1B1C2F` | same | Lavender: category blocks, Featured, Sponsored |
| `accentSoft` | `#C0C4FF` | same | The block behind a missing photo |
| `accentStrong` | `#6F5BD6` | `#B2A1FF` | The edge of the search circle, the story ring |
| `accentWash` | `rgba(178, 161, 255, 0.24)` | `rgba(178, 161, 255, 0.20)` | The inside of the search circle |
| `text` / `textMuted` / `textSubtle` | `#1B1C2F` / `#4A4C60` / `#585A6E` | `#F3F5F4` / `#BBBDCB` / `#9C9EB0` | Text |
| `border` / `outline` | `#C2BCE0` / `#77738F` | `#34364D` / `#7F8198` | Dividers inside a card / control boundaries (3:1) |
| `rating` | `#B97A00` | `#F2BE4A` | Rating stars only |
| `success` | `#1F7A3A` | same | The ring of the "Open now" dot |
| `danger` / `dangerSoft` / `onDangerSoft` | `#B3261E` / `#FBE4E1` / `#7A1410` | `#FFB4AB` / `#5C1612` / `#FFDAD5` | Errors only, and the assistant's emergency block |
| `dangerPressed` / `onDanger` | `#931F18` / `#FFFFFF` | `#FF8A7E` / `#3B0906` | The solid emergency Call buttons only |
| `whatsapp` / `whatsappPressed` / `onWhatsapp` | `#25D366` / `#1EB958` / `#062E17` | same | The WhatsApp button only |
| `scrim` / `onScrim` | `rgba(27, 28, 47, 0.72)` / `#FFFFFF` | `rgba(10, 11, 20, 0.72)` / `#FFFFFF` | Behind controls on photos, behind a sheet |
| `shadow` | `rgba(27, 28, 47, 0.20)` | `rgba(0, 0, 0, 0.50)` | The one shadow: the card over the map |
| `qrPaper` / `qrInk` | `#FFFFFF` / `#1B1C2F` | same | The share sticker and the poster only: dark on white in both themes |

In the light theme `primary` is purple, not ink: where the component notes below say "ink" for a button, a pill or a selected segment, they mean `primary` (near-white in the dark theme). Text itself is always `text` (`#1B1C2F`).

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
| `bodyLarge` / `bodyLargeStrong` | Readex Pro 400 / 500 | 17 / 26 | The assistant's reading text, card lines and facts |
| `actionLarge` | Readex Pro 600 | 17 / 24 | Large buttons (the assistant's main actions) |
| `input` | Readex Pro 400 | 20 / 30 | What the user types to the assistant |

The assistant is a step bigger on purpose: it is made for people who rarely use a phone.

## Shape and space

- Radius: `lg` 24 for cards, tiles and blocks; `sheet` 28 for the Home ink block and the profile sheet; `md` 14 for thumbnails and insets; `pill` for buttons, fields, chips and segmented controls.
- Spacing: a 4-point scale. 16 at the page edge, 10 to 12 between blocks, 16 to 20 inside them.
- Touch targets are 48 dp. Compact controls are 36 to 40 dp to the eye and reach 48 with `hitSlop`. The assistant's main actions are 56 dp (`size.buttonLarge`); the Home entry is 72 dp (`size.askEntry`); its typing field starts at 132 dp (`size.askInput`).
- Motion only marks a state change (120 to 200 ms). No entrance animations.

## Components

- **Button** (`Button.tsx`): one pill, 52 dp. `primary` ink, `whatsapp` green, `tonal` grey, `outline`, `white` (a quiet action on the ground or a lavender block), `danger` (emergency numbers only). `compact` tightens the padding for the three-button action bar. `large`: 56 dp, `actionLarge` words, a label that wraps to two lines instead of being cut.
- **Distance control** (`RadiusChips.tsx`): a grey pill track with four segments, 36 dp high, the chosen one ink. Used in one row on Home and in the Results header.
- **Verified filter** (`VerifiedFilter.tsx`): a pill whose name never changes, "Verified only", with a small switch at its end. On (the default): mint pill, ink track, white thumb at the end with a check. Off: grey pill, mid-grey track, empty thumb at the start. `accessibilityRole="switch"`.
- **List / Map switch** (in `results.tsx`): a grey pill track with two labelled segments (icon and word), the chosen one ink.
- **Category tile** (`CategoryTile.tsx`): a solid block, 112 dp high: icon top, name bottom, an arrow in the corner (chevron opens more choices, diagonal arrow goes to results). Tones: lavender, mint, grey. The grid alternates wide + narrow rows and steps the colours diagonally.
- **Badges** (`Badges.tsx`): pills, 24 dp. Verified (mint, check badge), Not verified (grey, empty badge), Featured (lavender, means paid), Founding member (outlined), and the "Listed by the community" line for a listing nobody has claimed.
- **Open status** (`OpenStatus.tsx`): a mint dot ringed in dark green plus "Open now", or an empty ring plus "Closed". Words are always ink.
- **Provider card** (`ProviderCard.tsx`): a grey block: photo, name, "category · area", the trust line, then a white strip with rating, distance and price in fixed columns. **Sponsored** variant (`sponsored: true`): the block is lavender, with an ink "Sponsored" pill and the sponsor's one-line hook; the API returns it first, so it sits at the top of the list.
- **Map pin** (`MapParts.tsx`): a pill carrying the provider's name (cut at 18 characters) with a pointer under it. Verified: white pill, ink edge, mint check disc. Not verified: grey pill, grey edge, empty ring, muted name. Featured: lavender pill. Selected: ink pill, larger. When names would overlap, only the most important keep their pill (selected, then sponsored and featured, then verified, then by rank; `layoutPins`); the others become a 22 dp dot (mint disc with a check, grey ring when not verified, lavender when featured) drawn under the names. Zooming in or tapping a dot brings its name back. The search position is a lavender dot with an ink ring; the search area is a lavender circle.
- **Story ring** (`StoryRing.tsx`): the mark for "this provider posted an update": a 2.5 dp deep-lavender ring (`accentStrong`) around the photo with a 3 dp gap, keeping the photo's rounded-square shape (never a circle). Ink on a lavender or mint block. Used on Home's "Updates nearby" row (`StoriesRow.tsx`: 68 dp ringed photo or initial, name, time ago), on result cards and in the profile hero.
- **Story viewer** (`app/stories/[providerId].tsx`): full-screen modal on the page ground. Opened from a stories row it goes on to the next provider of that row after the last update, and back to the previous one from the first; opened from a profile or a card it plays one provider. Progress segments (grey track, `primary` fill), photo + name + "time ago · category", close. A written update is one lavender (`hero`) block: category icon on a `primary` square at the top, the words at the bottom in `poster` / `display` / `headline` by length. With a photo, the photo fills the block and the words sit on a white block over its lower edge. Under it: a `primary` "View profile" pill and "Hold to pause". Six seconds each; no auto-advance under reduced motion or a screen reader.
- **Offer** (`OfferBlock.tsx`, `OfferTag` in `Badges.tsx`): on a profile, a `primary` block with white words (title, one sentence, "Ends in N days") and the discount as a `poster` figure on a white block (a tag icon when there is no figure). On a card, a `primary` pill with a tag icon and the title; never mint, which stays the trust colour.
- **Sponsored section** (in `results.tsx`): at most two sponsored cards under a "Sponsored / Paid placement" heading, then "All results"; category and everyone searches only, list view only. A sponsored provider outside the section is drawn as a plain card.
- **Follow** (profile): follower count on the start side, a 40 dp `primary` "Follow" pill at the end (grey with a check once following). Signed out it calls `requireSignIn()` (`src/lib/auth.ts`), which opens sign-in and follows when it closes. Signed in, the pill and count change at once and go back with a notice if the request fails.
- **Form parts** (`Field.tsx`): the Suggest field pattern shared by sign-in and My business (label set in, grey pill field, ink edge on focus, red on error, hint or error under it) and `Notice`: a block for one message, red-soft (error), white (information) or mint (done).
- **Code boxes** (sign-in): six white 60 dp tiles on the ground over one invisible field, so typing, pasting and the keyboard's code suggestion work; the next box to fill has the `primary` edge. Digits run left to right in Arabic too.
- **Sheet** (`Sheet.tsx`): one small task over a dimmed screen (`scrim`): the page ground with `sheet` top corners, a grab handle, a `headline` title and a grey round close. Back, the X and a tap on the dimmed part close it. Fades in.
- **Reviews card** (`ProviderReviews.tsx`): a grey card: the average as a `display` figure beside its stars and count; my own review in a white inset with tonal Edit and Delete (Delete asks once, in place); otherwise a `primary` "Write a review" pill. Then the latest three, and a white pill "See all N reviews" that opens the rest a page at a time.
- **Review sheet** (`ReviewSheet.tsx`): five 32 dp stars in 48 dp targets on a white block (a radio group, the word for the choice under them: Poor to Excellent), the name shown with the review, an optional comment.
- **Report** (`ReportSheet.tsx`): a quiet underlined "Report this listing" line with a flag at the very end of a profile. The sheet lists the reasons as white pills (the chosen one `primary`, with a white check disc), optional details, "We don't save anything about you", then a white thank-you block with a mint check disc.
- **Available now** (`AvailableTag` in `Badges.tsx`): a mint pill with a filled lightning icon and "Available now", on cards, the assistant cards and the profile's badge row. It replaces the open / closed status on a card while it is on. Lightning, not a check, so it never reads as Verified.
- **Available now switch** (`AvailableNowSection.tsx`, My business): a white block with the title (and the tag while on), the `SwitchRow` (hint "On until 3:30 PM" or "Off"), then "For how long" with three equal pills, 2, 4 and 8 hours, the chosen one `primary`. Picking another length while on restarts the count. A mint notice confirms.
- **Poster** (`app/poster/[slug].tsx`): two segments, "Your business" and "For a building". The paper is `qrPaper` with `qrInk` only, at least A4 height (`size.posterRatio`), with the QR code at `size.posterQrShare` of its width. English and Arabic sit side by side in two columns split by a hairline, always English left and Arabic right (printed, never mirrored); "Haddak" and "حدّك" at the two top corners; thick ink rules above and below the middle. Business: name (`poster`), category, the code of the profile link, "Scan to call or WhatsApp", the link, then "Find trusted help near you: Haddak". Building: the question for the natour's residents, the code of `https://haddak.app`, and a dashed empty "Natour code" box. Under the paper: Share link, Print (web only) and a one-line print hint.
- **Share sticker** (`ShareProfile.tsx`, props `slug` and `name`): the name, a QR code of `https://haddak.app/p/<slug>` and the Haddak wordmark in `qrInk` on `qrPaper` (pure white in both themes, with a 16 dp quiet zone) so it prints and scans as a door sticker; a `primary` "Share link" pill under it, and a tonal "Print a poster" pill when the caller passes `onPoster`. The profile opens it in a sheet from the share button.
- **Switch row** (`SwitchRow.tsx`): an on/off setting in a form. A grey block with the label and a one-line hint at the start and the "Verified only" switch at the end: off is a mid-grey track with an empty thumb at the start, on is a `primary` track with a white thumb and check at the end. The block stays grey (mint is for trust). `accessibilityRole="switch"`.
- **Business form** (`ProviderForm.tsx`, shared by List your business and Edit listing): white blocks on the ground, one per topic (What you do, How people reach you, Where you are, Opening hours, Photos, Proof), each with a `headline` title and an optional note; grey pill fields inside (`Field.tsx`); the `primary` button and any error docked above the keyboard; a focused field scrolls itself clear of the keyboard. Parts:
  - `CategoryPicker.tsx`: the Suggest category pill and its grey list with a white search pill.
  - `PinPicker.tsx` (`.web.tsx` stand-in): a 240 dp map (`size.mapPicker`) in a `lg` block with one draggable pin in `primary`; tapping the map moves it. A tonal "Use my location" button under it.
  - `HoursEditor.tsx`: one row per day (name, Open / Closed, the small switch), then two centred 24-hour time pills (`size.timeField`) when open; "Use Monday's times for every open day" as a text link.
  - `PhotoPicker.tsx`: 96 dp rounded photo tiles (`size.photoTile`, `radius.md`) with a 36 dp scrim remove button at the top end (48 with `hitSlop`), a scrim "Cover" tag on the first, a spinner or "Try again" veil while uploading or after a failure, then a grey "Add photo" tile. The proof is one grey block with a lavender icon square that opens the picker; once chosen, the thumbnail with Change and Remove, and a lock line saying only Haddak sees it.
- **Ask entry** (Home, inside the lavender block): a white `lg` block, 72 dp, with the assistant's name in `headline` and "Say or type what you need" in `bodyLarge`, and a 56 dp `primary` disc with an arrow at the end. When the phone can listen (development build), the block splits in two: the words open the assistant to type, and the disc carries a microphone and opens it already listening; in Expo Go the disc stays an arrow. Under it two example sentences as pale-lavender (`background`) pills, 48 dp, that open the assistant and ask at once. The name comes only from the `assist.name` string (the founder is still choosing it).
- **Assistant card** (`AssistCard.tsx`): one of the assistant's top three, compact so two whole cards fit on a 390 x 844 screen under the question (about 222 dp each). A white `lg` block: 84 dp photo, name in `title`, "category · area" in `body` (one line), the Verified pill and open status or Available now; a slim grey strip with distance, price and rating in `bodyLargeStrong`; then WhatsApp and a `tonal` Call side by side, each 56 dp and half the width. Photo and name open the profile.
- **Assistant blocks** (`app/assist.tsx`): white `lg` blocks for a question with big `primary` choices (clarify, two places with one name), "Looking…" (spinner, `headline`, one line) and the off-topic line; the question after an answer is a white 56 dp pill with the words on one line, a grey microphone disc (when the phone can listen) and a `tonal` Edit pill; the summary is a compact lavender row (`title`, two lines at most, an arrow) that opens the full list, with Read aloud as a 48 dp white disc at its end; notes ("we looked further", "place not found") are one short muted `body` line with a small info icon, right under the summary; emergency and errors are `dangerSoft` blocks, emergency with solid `danger` Call buttons; example sentences are white 56 dp rows with an arrow.
- **Filter pills** (Results header): first an "Available now" switch pill that is always there (grey with a lightning icon when off, `primary` with an X when on); then the assistant's filters as `primary` pills with white words and an X ("Up to $20 an hour", "Open now", "Nearest first"); a tap removes the filter.
- **State view** (`StateView.tsx`): a lavender disc with the icon and a mint dot; errors use the error colours.

## Screens

- **Home:** wordmark, saved and language. A lavender block with the question, the search position, the Ask entry and two example sentences, then a quiet "Search by name" link that opens the old pill field for search by name (round mint search button) in place. One compact distance row. The category grid. A wide "Everyone nearby" block. Nothing is pinned to the bottom: a tap on a category searches.
- **Results:** one header: back, title and count, List / Map; under it distance and the verified filter. Then the list of blocks, or the map filling everything under the header.
- **Provider profile:** photos, then a hero block (mint when verified, grey when not) with the name and the verification line; three fact blocks; opening hours, about and reviews as grey cards; an action bar with WhatsApp, Call and Directions.
- **Saved:** a big title and one grey block per saved provider.
- **Sign-in** (modal): a close button; a lavender block (icon, title, one sentence) as on Suggest; the email field, or the code boxes with "New code in 0:42" / "Send a new code" and "Use another email"; the `primary` button and any error docked above the keyboard.
- **Following:** back and a big title; a white account block (email, Sign out, and a lavender "My business" row); "Their updates" (the stories row) and "You follow" (result cards). Signed out: a state view with Sign in.
- **My business:** the listing as a mint block when verified (white otherwise), tonal "Edit listing" and "Print a poster" buttons, the Available now block (for every owner, verified or not), then a white "This month" block: four grey tiles (profile views, WhatsApp taps, calls, followers) with the figure in `display` and its name under it, the month at the end of the title; no chart. Then one white block each for Updates (compose, count of 5, posted updates with an in-place delete confirmation), Offer (the profile's offer block as a preview, or the form with 1 to 7 day pills) and Sponsor line. Not verified: a lavender block saying posting opens after verification, with a "Send proof" button when no proof is waiting. No listing: a state view with "List your business" and a link to Suggest.
- **List your business** (`join.tsx`): a back arrow; the lavender intro block (shop icon, title, one sentence); the business form. After sending: a state view saying the listing is live without the badge and what happens to the proof, then "Go to My business". Reached from My business and from a quiet text link at the bottom of Home (sign-in first).
- **Edit listing** (`business-edit.tsx`): back and a `headline` title, then the business form filled in; saving sends only what changed and returns to My business.
- **Assistant** (`assist.tsx`): back and the assistant's name; a white typing field (big type, tall until something is asked); a row of two 56 dp buttons, `tonal` Speak (microphone) and `primary` Send (Send alone where there is no speech module). While listening the field gets an ink edge and a lavender microphone disc with "Listening…" at its top, the heard words fill in under it, and the row becomes one `primary` "Stop and send" button; a microphone problem is a plain note line under the buttons; then the answer: example sentences (nothing asked yet), "Looking…", an error with Try again, or the answer blocks above. Once something is asked, the field and buttons fold into the one-line question bar (Edit opens them again; speaking opens them while listening). Results show the summary row and its notes, then at once the top three assistant cards and a white "See all N results" button when there are more than three. Clarify, emergency, off-topic and no-results answers sit under the same bar. No results: "Nobody found yet" with "Search wider" and "Tell us who you need" (Suggest).
- **Suggest:** a back arrow; a lavender block with the icon, the title and one sentence; then the questions as grey pill fields (52 dp, the note is a block), labels set in to line up with the typed text, the edge turning ink on focus and red on an error; the ink button stays docked above the keyboard.

## Right-to-left

Arabic mirrors every row through the `row`, `start` and `end` helpers in `src/i18n`. Arrows flip; phone numbers and counts stay left-to-right. Names and prices take their direction from their own text.

## What is verified

Checked in the web build at 390 x 844 (screenshots in `design-preview/`): Home in English, Arabic and dark; Results with unverified included; the map preview; a verified profile. Not yet checked on an Android device: the native map (pin labels, height), font scaling at large sizes, and the dark theme beyond Home.
