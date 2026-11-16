# Haddak assistant (version 1)

Decided with the founder on 2026-11-16. The goal is that someone who rarely uses a phone can open Haddak, say what they need in their own words, and reach the right person in two taps.

## The rule: the AI understands, our code acts

The AI does one job: turn a sentence into search settings. Searching, ranking, prices, phone numbers and sending messages are all done by our own code and data, so they are predictable, testable and free.

```
"baddé 2ostez riyadiyat la ebné, 2arib, a2al men 20$ bel se3a"
        │
        ▼  1. Understand  (one AI request; skipped when the same sentence was seen before)
{ categories: ["tutor-math"], radius_m: 500, max_price: 20, price_unit: "hour",
  currency: "USD", sort: "distance", place: null, whatsapp_draft: "..." }
        │
        ▼  2. Find        (existing PostGIS search, free)
top results, ranked: verified → sponsored → rating → distance
        │
        ▼  3. Show        (app, free)
"Maths tutor · near you · up to $20/hour"  +  3 big cards  +  "Message on WhatsApp"
```

## What the AI may return

Exactly one fixed JSON shape (structured output), never free chat:

- `kind`: `search` (normal), `clarify` (one question), `emergency`, `off_topic`.
- Search settings: category slugs (from our list only), optional name keyword, optional place name, radius, max price + unit + currency, open now, sort.
- `clarify`: one short question and 2–4 options, each option already a full set of search settings. Tapping an option searches directly, with no second AI request.
- `whatsapp_draft`: a short polite first message in the user's language, built only from what the user said.

The AI never sees the user's location, name, email or any provider data. It sees the sentence and our category list.

## Hard limits

| Guard | Default | Where |
|---|---|---|
| Skip the AI when the text exactly matches a category or provider name | on | backend |
| Remembered answers: same normalised sentence → stored settings | on | `assist_cache` table |
| Requests per IP per day | 30 | `ASSIST_DAILY_LIMIT` |
| Spending cap per calendar month | $10 | `ASSIST_MONTHLY_BUDGET_USD` |
| Model | `claude-haiku-5-5` (cheapest; the founder asked for low cost). Switch to `claude-sonnet-5-5` only if the phrase test shows Haiku misses too much. | `ASSIST_MODEL` |
| No key, cap reached, or AI error | assistant answers `unavailable`; the app falls back to normal search | backend |

Every AI request is logged with its token counts and cost (`assist_log`), with no user id.

## Places

A place name in the sentence ("in Jounieh", "b Hamra") is looked up in our own `places` table (English and Arabic names, common spellings, centre point, radius). The search is then centred there instead of on the phone. Two places with the same name → the app shows both as buttons. Unknown place → search near the phone and log the name. The first table is a small hand-made list of main cities and Beirut neighbourhoods with approximate centres; a full import from GeoNames (free, CC BY, credit shown in the app) replaces it later.

## Prices

Today prices are free text (`price_text`). A price filter needs structured fields on `providers`: `price_amount`, `price_unit` (hour, visit, job, item, month), `price_currency` (USD or LBP). `price_text` stays as the description. Providers without a structured price are kept when no price limit is asked for, and left out when one is.

## Voice and reading aloud

- Speaking: in Expo Go the app relies on the keyboard's own microphone (Gboard and the iPhone keyboard both have one, free). A dedicated hold-to-talk button needs a native speech module and comes with the first store build.
- Reading aloud: results can be read aloud with the phone's built-in text-to-speech (`expo-speech`), free.

## Emergencies

If the sentence describes an emergency, the app shows emergency numbers built into the app (Lebanese Red Cross 140, Civil Defence 125; to be re-checked before release), never numbers written by the AI.

## Measuring before trusting

`backend/evals/assist_phrases.jsonl` holds about 100 real-style phrases (Lebanese Arabic, Arabizi, English, French, mixed) with the expected settings. `scripts/eval_assist.py` runs them against the real model and prints the score and the cost. It spends real money (well under $1 a run), so it only runs when the founder agrees.

## Later (not version 1)

- Open chat about one provider ("does he fix iPhones?"), answered only from that provider's description and reviews.
- Menus with item prices ("cheapest shawarma near me"): needs a menu items table first; Postgres full-text or `pgvector` before any extra framework.
- An agent that compares several providers or books a time.
- Sending messages for the user is never automatic: WhatsApp always opens with the draft and the user taps Send.
