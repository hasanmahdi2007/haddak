# Haddak — project record

Haddak (حدّك, "next to you") is a mobile app for finding a verified professional or shop near you in Lebanon: a laptop repair person, a saxophone teacher, a dermatologist, a tutor, anything. You pick what you need and how far you are willing to go, and you get a ranked list and map of verified people with ratings and prices, then contact them on WhatsApp or by phone.

This file records what was decided and why. Update it whenever a decision changes.

## The problem

Finding a good professional in Lebanon runs on "who knows someone". Google Maps covers shops with storefronts, and even those listings are often missing or outdated. Individuals such as tutors, music teachers, technicians and freelancers live on WhatsApp and Instagram and are not findable by location, quality or price.

## What makes Haddak different

- **The data, not the app.** Category + radius search is easy to copy. A verified, rated list of Lebanese providers is not.
- **Verification.** Every provider shows proof (certificate, shop photo) and is approved by hand before appearing.
- **Public prices.** Providers can post a price or price menu. Rare in Lebanon, and a reason to use Haddak over Instagram.
- **All professions, one app** as the long-term vision. Launch is dense in one area first, then expands.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Name | Haddak, always spelled this way (never "7addak") | Means "next to you"; one spelling for word of mouth |
| First platform | Mobile app, Android first | Most of Lebanon is on Android; Apple costs $99/year |
| App | Expo (React Native, TypeScript) | Founder knows React; one codebase for Android and iOS |
| Backend | FastAPI (Python) for everything | One codebase; AI features later are easiest in Python; the database is the real scaling limit, not the language |
| Database | Postgres + PostGIS, hosted on Supabase | Radius search built in; standard Postgres, movable later |
| Login, photo storage | Supabase Auth and Storage | Free tier; no SMS codes (each SMS to Lebanon costs cents), use Google or email sign-in |
| Map | `react-native-maps` (Google map on Android) | Showing the map in a native app is free |
| Contact | WhatsApp and phone links | No chat system to build |
| Search v1 | Buttons: category + radius. No AI | No per-search cost; proves the idea first |
| Search later | AI turns a typed sentence into the same filters | One small model call per search; nothing is rebuilt |
| Unverified listings in search (2026-11-17) | Shown by default, always after every verified one, below a quiet "Not verified yet" divider. "Verified only" is a switch the user can turn on | An almost empty map loses users before verification can scale; the badge still decides the order |
| OpenStreetMap import (2026-11-17) | Named shops and practices from OSM are imported as `unverified`, unclaimed listings with attribution. Licence ODbL: shown with "Data © OpenStreetMap contributors"; a shared copy of the database would have to stay ODbL | Fills the map from day one with data we may legally use (unlike Google's) |
| Claiming listings (2026-11-17) | "Is this your business? Claim it": a signed-in owner asks, the founder approves by hand; "This is my business and I want it removed" is a report reason | Owners listed without consent need a way in, or a way out |
| Spring Boot | Not used. Revisit only if one specific piece ever needs it | Founder is stronger in Java, but two services are overhead for one person |
| Scope: every paid service and shop (2026-11-24) | Haddak covers "everything that has money related to it, even volunteering": tradespeople and professionals, and also shops, food (restaurants, fast food, cafés, bakeries), groceries, fashion, home shops, pets, everyday services (laundry, printing, money transfer, lawyers…), events, and NGOs. The category tree grows from 58 to 143 (see `SCHEMA.md`), filled from OpenStreetMap | Founder decision. One app for every "where do I find…" question gives daily use, not a few times a year. Trade-offs we accept: much more data to keep tidy (answered by search first, progressive disclosure, paging; see the UX rules below), and the fair-price guide is harder for retail (answered by price levels, see `FAIR_PRICE.md`) |
| UX rules (2026-11-24) | Never messy and never lose data: search bar first; home shows a few groups, "All categories" shows everything; every growing list pages 20 at a time with "Showing 20 of N"; map pins cluster; few results means offer a wider radius, never an empty screen. The look must appeal to teens and people in their 20s (bold, playful Lebanese Arabic, share cards) and stay fast for adults (two taps to WhatsApp) | Founder decision; the larger catalogue only works if it stays calm and fast |
| Search text (2026-11-24) | The search box matches business names, category names and keywords in Arabic, English and Arabizi (typos allowed), and area names. Among unverified listings, ones with a phone come first | "سنكري" or "falafel" must find plumbers and falafel places, not only businesses with that word in their name |

## Google Maps: costs and rules

- A business listing itself on Google Maps is free. Google earns from ads.
- Showing a Google map inside a native mobile app is a no-cost item on Google's price list.
- Paid lookups (address to coordinates, autocomplete, Google's places search) have monthly free limits, then cost per 1,000. Haddak avoids them: providers drop their own pin, and search runs on our database.
- A billing account with a card is required for an API key.
- **Google's listings may not be copied into our database.** Their terms forbid it. Provider data is collected by us, plus OpenStreetMap data (ODbL, with attribution; see `SCHEMA.md`).
- Fallbacks if pricing changes: Mapbox (free up to 25,000 monthly mobile users) or OpenStreetMap-based maps.

## Running costs (approximate; check current prices)

| Stage | Cost |
|---|---|
| Building and testing | $0 |
| Google Play developer account | $25 once |
| Apple developer account (later) | $99 per year |
| Domain | about $12 per year |
| Backend server once live | about $5–10 per month |
| Supabase paid plan, once free tier is outgrown | about $25 per month |
| Maps | $0 at early scale |
| AI search (later) | well under a cent per search |

Marketing (Instagram and TikTok ads aimed at one area) is the real cost, and only worth spending once that area has providers.

## Revenue plan

Listing is free forever. Expect close to zero income for the first 6–12 months.

1. **Featured placement, $10–20 a month.** Top of the category in the provider's area, with a highlight. These are the app's "ads".
2. **Extras for paying providers.** More photos, full price menu, view statistics.
3. **Booking commission, much later.** Only for bookable things such as lessons, at 10% or more. A 1% cut loses money against payment fees of about 3%, and cash deals bypass it.

Charge only once there is proof. Every WhatsApp tap, call tap and profile view is counted per provider from day one, so a provider can be told "14 people contacted you through Haddak this month".

Collect payments by hand at first (Whish, OMT, cash) and mark the provider as featured manually. Third-party ads inside the app are not planned: they earn little at small scale and cheapen the app.

## Launch: getting the first providers

The cold start is the main risk. The founder recruits providers one by one, starting with family, colleagues and the home area, and fills one area properly before moving to the next.

- **Do it for them.** Build the profile on the founder's phone in two minutes, in front of the provider.
- **QR door sticker.** "Verified on Haddak: scan to see our profile and reviews."
- **Founding member.** The first 100–200 providers get a permanent badge and a free year of featured placement.
- **Monthly WhatsApp message** with their view and contact counts.
- **Bring three, get featured.** A provider who refers three others gets a featured month.
- **Ads** only after an area has enough providers that a search returns five or more good options.

## Risks

- Most local directories fail on supply: not enough good providers in one place.
- Low frequency of use: people need a professional a few times a year.
- Small market and hard payments in Lebanon; the ceiling is a solid small business unless it expands abroad.
- Verification differs by profession (a doctor's licence is not a shop photo) and is manual work.

## How to judge whether it is working

In the first area, after a few weeks of recruiting:

| Result | Meaning |
|---|---|
| 50+ providers listed, real searches, some providers got clients | Keep going and expand |
| Providers listed but almost no searches | Demand or marketing is the problem |
| Cannot get 50 providers to accept a free listing | Rethink before investing more |

The project is also a portfolio piece: geographic search, logins, reviews, tests, automated checks, and later AI.
