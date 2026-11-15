# Haddak mobile app

Expo (React Native, TypeScript, Expo Router), SDK 58. Android first; the same code runs on iOS and, for previews, in a browser.

Built so far (tasks M1 to M3): Home / search, Results list, Provider profile, English and Arabic with right-to-left layout, a typed API client, and a mock data mode. Not built yet: map view, sign-in, provider sign-up, writing reviews, QR codes.

## Run it

```bash
cd mobile
npm install
npx expo start
```

Then open it on a phone with **Expo Go** (Android): install Expo Go from Google Play, make sure the phone and the computer are on the same Wi-Fi, and scan the QR code shown in the terminal. If the phone cannot reach the computer, use `npx expo start --tunnel`.

Other targets:

```bash
npx expo start --web       # in a browser, handy for quick looks
npx tsc --noEmit           # typecheck
npx expo lint              # lint
npx expo export --platform android   # check that the Android bundle builds
```

## Mock mode and the real backend

The app reads one setting, `EXPO_PUBLIC_API_URL`.

- **Unset (the default): mock mode.** The app runs on built-in data: 27 invented providers around Haret Hreik and 12 categories with children (`src/api/mockData.ts`). Mock search really filters by radius, category and name, and ranks exactly as `docs/SCHEMA.md` says (featured first, then weighted rating, then distance). Requests take about half a second so loading states are visible. Contact events are counted in memory and logged to the console.
- **Set: the real backend.** Give the address of the FastAPI server, without `/api/v1`:

  ```bash
  # backend on this computer, app in the browser
  EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start --web

  # backend on this computer, app on a phone: use the computer's Wi-Fi address
  EXPO_PUBLIC_API_URL=http://192.168.1.20:8000 npx expo start
  ```

  In PowerShell: `$env:EXPO_PUBLIC_API_URL = 'http://192.168.1.20:8000'; npx expo start`. You can also copy `.env.example` to `.env.local` and put the value there. Restart Expo after changing it. On a phone, `localhost` means the phone itself, so use the computer's address, and start the backend with `--host 0.0.0.0`.

Everything in mock mode is fake, including names, reviews and prices. Photos are placeholder stock images from Unsplash and need an internet connection; without one, the no-photo design shows instead.

## Where things are

| Path | What |
|---|---|
| `DESIGN.md` | The design system: colours, type, spacing, components, right-to-left rules |
| `src/theme/tokens.ts` | The same tokens in code. Screens use only these |
| `PRODUCT.md` | Short product record used by the design tooling |
| `src/app/` | Screens (Expo Router): `index.tsx` Home, `results.tsx`, `provider/[id].tsx` |
| `src/components/` | Shared pieces: `Txt`, `Button`, `CategoryTile`, `RadiusChips`, `ProviderCard`, `Badges`, `Rating`, `StateView`, `Skeleton`, `Photo` |
| `src/api/` | `types.ts` (every shape in `docs/API.md`), `http.ts` (real client), `mock.ts` + `mockData.ts` (mock client), `index.ts` (picks one) |
| `src/i18n/` | `en.ts`, `ar.ts` (all strings) and the language and direction logic |
| `src/lib/` | Location with fallback to Haret Hreik, categories, radius choices, link builders |
| `design-preview/` | Screenshots of the screens in English and Arabic, light and dark (`dark/`); `options/` keeps the three Home options the design was chosen from |

## Rules for new screens

- Colours, sizes and type come from `src/theme`. No raw values.
- All text goes through `Txt`, and every string lives in `src/i18n/en.ts` and `ar.ts`.
- Rows use `row` from `useI18n()` so they flip in Arabic. See "Right-to-left" in `DESIGN.md`.

## Location

The app asks for location when it opens. If permission is denied or no position arrives within 8 seconds, it searches around Haret Hreik (33.8547, 35.5097) and shows "Use my location" in the header.

## Screenshots

The files in `design-preview/` were taken from the web build (`npx expo start --web`) with a headless Chrome at a 390 x 844 phone viewport, at 2x, in mock mode. They show layout, type and colour faithfully, but they are not captures from an Android device: status bar, ripple effects and system fonts for fallback glyphs will differ slightly on a phone.
