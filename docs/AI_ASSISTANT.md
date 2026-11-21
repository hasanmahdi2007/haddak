# Haddak assistant: Jarak AI (version 1)

The assistant is called **Jarak AI** (جارك AI, "your neighbour"; the "AI" makes clear it is not a real person). The name appears only in the app's i18n strings (`assist.name`, `assist.title`).

Decided with the founder on 2026-11-16. The goal is that someone who rarely uses a phone can open Haddak, say what they need in their own words, and reach the right person in two taps.

## The rule: the AI understands, our code acts

The AI does one job: turn a sentence into search settings. Searching, ranking, prices, phone numbers and sending messages are all done by our own code and data, so they are predictable, testable and free.

```
"baddé 2ostez riyadiyat la ebné, 2arib, a2al men 20$ bel se3a"
        │
        ▼  1. Understand  (one AI request; skipped when the same sentence was seen before)
{ categories: ["math-tutoring"], radius_m: 1000, max_price: 20, price_unit: "hour",
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
| Free AI requests per day, signed-in account | 30 | `ASSIST_DAILY_LIMIT_SIGNED_IN` |
| Free AI requests per day, phone when signed out | 15 | `ASSIST_DAILY_LIMIT_ANONYMOUS` |
| Free AI requests per day, everyone on one IP together | 100 | `ASSIST_DAILY_LIMIT_PER_IP` |
| All assistant requests per minute per IP | 20 (then 429) | `app/rate_limit.py` |
| Spending cap per day (Lebanon time) | $1 | `ASSIST_DAILY_BUDGET_USD` |
| Spending cap per calendar month | $10 | `ASSIST_MONTHLY_BUDGET_USD` |
| Model | `claude-haiku-5-5` for English, French and Arabic script (cheapest). Arabizi goes to `claude-sonnet-5-5` (model routing, below). | `ASSIST_MODEL`, `ASSIST_MODEL_ARABIZI` (empty = no routing) |
| No key, a spending cap reached, daily allowance used, or AI error | free keyword fallback (below); `unavailable` only when it finds no category, then the app falls back to normal search | backend |

Every AI request is logged with its token counts and cost (`assist_log`), with no user id.

## Places

A place name in the sentence ("in Jounieh", "b Hamra") is looked up in our own `places` table (English and Arabic names, common spellings, centre point, radius). The search is then centred there instead of on the phone. Two places with the same name → the app shows both as buttons. Unknown place → search near the phone and log the name. The first table is a small hand-made list of main cities and Beirut neighbourhoods with approximate centres; a full import from GeoNames (free, CC BY, credit shown in the app) replaces it later.

## Prices

Today prices are free text (`price_text`). A price filter needs structured fields on `providers`: `price_amount`, `price_unit` (hour, visit, job, item, month), `price_currency` (USD or LBP). `price_text` stays as the description. Providers without a structured price are kept when no price limit is asked for, and left out when one is.

## Voice and reading aloud

- Speaking: a **Speak** button (`expo-speech-recognition`, the phone's own recognizer, free, no cloud provider of ours). Tap to start, then talk; the phone stops listening after a short silence and the sentence is sent at once. A second tap ("Stop and send") ends early. The words fill the field while they are heard. Arabic asks for `ar-LB`, then `ar`; English `en-US`. On-device recognition is used when the phone has that language pack installed, otherwise the phone's normal service. Refused microphone, nothing heard, no network or no recognizer each get one plain sentence (and "Open Settings" when the microphone is blocked). Only in the development build: Expo Go and the web have no such module, so the button is hidden there (`src/lib/useVoice.ts`, `requireOptionalNativeModule`). On Home a microphone disc at the end of the Ask entry opens the assistant already listening (`/assist?listen=1`). Tap rather than hold, because holding a button while speaking is hard for older hands.
- Reading aloud: results can be read aloud with the phone's built-in text-to-speech (`expo-speech`), free.

## Free keyword fallback (no AI)

When the AI cannot be asked (no `ANTHROPIC_API_KEY`, monthly cap reached, daily allowance used, or the AI request failed), `app/services/assist/keywords.py` reads the sentence with plain word lists instead, at no cost:

- **Word lists:** about 1,350 words and phrases (15 to 76 for each specific category, fewer for the group categories) in Arabizi, Lebanese Arabic, English and French, including the problems people describe: `el brad ma 3am ybarred`/`frigo`/`tallaje` → `ac-repair` (no appliance category; cooling technicians fix fridges); `kahraba`/`2at3a`/`ishtirak`/`moteur`/`solar`/`inverter`/`batarié` → `electrician`; `may 3am tnazzel`/`naz`/`tasrib` → `plumber`; `laptop ma 3am ye2la3`/`pc` → `laptop-repair`. Vague words (`2ostez`, `drous`, `7akim`, `fever`/`s5oune`) are used only when nothing more precise matched, so `2ostez riyadiyat` is math tutoring and `s5oune, 7akim atfal` is the pediatrician.
- **Arabizi spelling** (`normalize.arabizi_word`, used only here, never for the cache key): lower case, no accents, digits as letters (2 dropped, 3 → a, 5 → kh, 6 → t, 7 → h, 8 → gh, 9 → s), `ch` = `sh`, `ou`/`o` = `u`, `ee` = `i`, `q` = `k`, `ph` = `f`, any doubled letter once, and a final i/y/e alike. So `baddé`/`baddi`/`baddddé` are one word, and so are `2ostez`/`oustez`. Two listed words that end up with the same spelling (`hala2` "now" and `7ala2` "barber") are only matched as typed.
- **Matching, in order:** longest phrase first, skipping filler words (`el`, `3am`, `ma`, `w`, `la`, `the`), so `may 3am tnazzel men el sakf` matches `may tnazzel`. Then one word: as listed (with small Arabic prefixes/endings: `البراد`, `برادي`); its Arabizi spelling (with small prefixes/endings: `lsankari`, `sayyarte`, `ysalle7li`); one letter wrong when both words have 5+ letters (`plumbr`, `electrisien`); the same 4+ consonants (`snkri` = `sankari`, `kondarje` = `kundurji`); two words typed without a space (`baddesankari`). The guessing steps look only at category words, skip a list of common words (`kifak`, `okhte`, `match`, `moins`) and never touch a known place name (`3anjar` is a town, not `najjar`), so chat and gibberish still find nothing.
- **A car changes some words:** with `sayyara`/`car` in the sentence, `kahraba`/`batterie` → `car-electrician`, `moteur`/`zeit`/`start` → `mechanic`, `ghassel`/`wash` → `car-wash`; without one, `moteur` and `batterie` are the house's generator and battery (`electrician`).
- **Simple patterns:** "near me"/`2arib`/`orib`/`hon`/`janbe`/"قريب" → 500 m; `cheap`/`rkhis`/`mech ghali`/"pas cher"/"رخيص" → sort by price; `closest`/`a2rab`/"أقرب" → sort by distance; "under 20"/`a2al men 20`/`ma bi zid 3an 20`/`ta7t 20`/"not more than 1,500,000 LL"/"بأقل من ٢٠" → a price limit (unit from the words `se3a`, `ziyara`, `chahr`..., else from the category group: tutors by the hour, doctors per visit, repairs per job, shops per item; currency USD unless lira/alf is said); "open now"/`fete7 hala2`/"هلق" and urgent words (`urgent`, `daroure`, `3ajal`, `bi sor3a`, "ضروري", "عاجل") → open now, which also keeps providers marked "Available now" (the AI prompt has the same rule); a place name through `find_place` (fuzzy after "in", "b", "fi", "في"; exact for any other leftover word).
- The answer is the same `results` response as an AI answer (template summary, no WhatsApp draft), logged with `source` = `direct`. No category matched → `unavailable`, as before. With a key and budget, the AI path is unchanged.
- **Measuring it (free):** `python evals/keyword_eval.py [--misses]` runs only this keyword path over `evals/assist_phrases.jsonl` (now 198 phrases, 85 Arabizi searches, 20 that must find nothing), with no AI, network or database, and prints category accuracy per style. 2026-11-16: before this work 79% of categories overall and 71% on Arabizi (20/20 nothing-found right); after, 100% and 100% on that file (20/20). The words were tuned on that file, so `tests/test_keywords_arabizi.py` also holds 34 Arabizi sentences written separately (33 of 34 passed before any tuning for them) and fails if Arabizi drops below 85%.

## Emergencies

If the sentence describes an emergency, the app shows emergency numbers built into the app (Lebanese Red Cross 140, Civil Defence 125; to be re-checked before release), never numbers written by the AI.

## Measuring before trusting

`backend/evals/assist_phrases.jsonl` holds about 100 real-style phrases (Lebanese Arabic, Arabizi, English, French, mixed) with the expected settings. `scripts/eval_assist.py` runs them against the real model and prints the score and the cost. It spends real money (well under $1 a run), so it only runs when the founder agrees.

## How the backend does it (settled in the build, 2026-11-16)

Code: `backend/app/services/assist/` (`normalize.py`, `prompt.py`, `ai_client.py`, `cache.py`, `budget.py`, `quota.py`, `places.py`, `summary.py`, `service.py`) and `backend/app/routers/assist.py`.

- **Order of checks for a sentence:** exact category name (English, Arabic or slug) or exact provider name → search, no AI; then `assist_cache` (SHA-256 of the normalised sentence, answers kept 30 days); then key set → monthly budget → today's budget → daily allowance (counted only when the request is about to reach the AI); then one AI request.
- **Daily allowance (`quota.py`):** each AI request counts against the person (the signed-in account, or else the phone's install id from `X-Haddak-Device`) and against the IP address. The IP allowance is higher because many phones on Alfa and Touch share one public address (carrier NAT), and it is what stops a script that invents a new install id per request. Each count is one atomic insert-or-add in `assist_quota`, so two requests at once cannot both take the last one; a refused request counts for nobody (rolled back). Rows hold `HMAC-SHA256(ASSIST_QUOTA_SECRET, day + who)`, never the IP, account or install id, and are deleted after two days.
- **Why these numbers:** a real person asks Jarak a few times a day at most, and exact names and remembered sentences are free, so 15 (30 signed in) is never reached by normal use. The worst case is about 1.5 cents per AI request (Sonnet writing the prompt cache); the usual cost is 0.1 to 0.2 cents. The $1 daily cap means abuse can cost at most $1 a day and never the whole month's $10. Any failure on the way → `unavailable`.
- **Normalising:** lower case, accents and Arabic marks removed (hamza forms → plain letter, ة → ه, ى → ي), punctuation → space, spaces collapsed. The SQL function `normalize_name()` does the same letter rules for place lookup.
- **The request:** official `anthropic` Python SDK (2.8.0), `messages.parse()` with the Pydantic class `AIResult` as the output schema (structured output). `effort: low`; thinking `disabled` on Haiku 5.5 (Sonnet and Opus 5.5 refuse that, so they get low effort only); `max_tokens` 1024; 8 s timeout, 1 retry. The system prompt (rules, four short examples, the category list from the database in a fixed order) carries a prompt-cache marker and contains no dates or ids.
- **Checking the answer:** unknown slugs dropped (max 3), radius snapped to 500/1000/5000/20000, a price limit needs an amount and a unit (currency defaults to USD), `q` 2–60 characters, clarify needs a question and 2–4 options that each search for something (one good option becomes a normal search), emergency and off_topic lose all settings. A `refusal` or cut-off answer counts as an AI failure.
- **Cost:** tokens × a small price table in `ai_client.py` (Haiku 5.5: $0.10 in, $0.50 out, $0.01 cache read, $0.125 cache write per million tokens; an unknown model is costed high on purpose). Every request is logged in `assist_log` with `source` = `ai`, `cache` or `direct` (only `ai` rows cost money).
- **Places:** about 80 hand-placed cities, towns and Beirut neighbourhoods (approximate centres) inserted by migration 0006. Exact match on name or alias first, then pg_trgm similarity ≥ 0.35. A found place centres the search and sets the radius to at least its size. Two rows with the same English name (Jdeideh, Matn and Marjayoun) → `place_options`.
- **Search:** the normal search service, unverified providers included after the verified ones, up to 20 results, widening 1 → 5 → 20 km when nothing is found. Nothing to search for (no category, no name) → empty results, logged as wanted.
- **Most wanted:** `GET /admin/assist/wanted` and the admin page's Wanted tab list the normalised sentences that found nothing (last 30 days), unknown place names, and this month's spend.
- **Tests** mock the client; nothing reaches the network (`tests/conftest.py` blocks the real client in every test).

### Running the phrase test

`backend/evals/assist_phrases.jsonl` has 102 phrases (Lebanese Arabic, Arabizi, English, French, mixed) using only seed category slugs. `python scripts/eval_assist.py --check` checks the file for free. `python scripts/eval_assist.py` (optionally `--limit N`, `--model claude-sonnet-5-5`) calls the real model, prints the score per field, the misses, total tokens and cost. It refuses to run without `ANTHROPIC_API_KEY`. Add `--route` to route by script like production.

### Model routing by script (2026-11-17)

Haiku misreads Arabizi (Lebanese Arabic in Latin letters) more often, Sonnet costs 20x more per token. So plain code picks the model per sentence, no extra library: `detect_script(text)` in `normalize.py` returns `arabic` (mostly Arabic letters), `arabizi` (a digit used as a letter inside a word such as `7ada`, `3am`, `2arib`; or at least 2 common Lebanese Arabizi words such as `baddi`, `shu`, `kif`, `ktir`; "20k" or "15usd" do not count) or `latin` (English, French). `choose_model()` in `ai_client.py` sends `arabizi` to `ASSIST_MODEL_ARABIZI` when it is set and everything else to `ASSIST_MODEL`. The keyword path still runs first and is unchanged. The chosen model is written to `assist_log.model` and costed with its own prices (Sonnet 5.5: $2 in, $10 out, $0.10 cache read per million tokens). The cache key is the normalised sentence only, not the model.

Phrase test, 213 phrases (`eval_assist.py`):

| Run | Categories right | Cost per 213 phrases |
|---|---|---|
| Haiku only | 85% | $0.027 |
| Sonnet only | 97% | $0.457 |
| Routed (`--route`) | 94% (kind 98%) | $0.262, about $1.23 per 1,000 AI searches |

Routed, kind and categories both right, per style: Arabic 27/27, Arabizi 97/104 (93%), English 37/39 (95%), French 13/13, mixed 28/30 (93%). 112 of 213 phrases (53%) went to Sonnet; the test set is Arabizi-heavy (104 of 213 phrases plus mixed ones), real traffic should send less. Cache hits and exact matches cost nothing, so real cost per 1,000 searches is lower.

## Later (not version 1)

- Open chat about one provider ("does he fix iPhones?"), answered only from that provider's description and reviews.
- Menus with item prices ("cheapest shawarma near me"): needs a menu items table first; Postgres full-text or `pgvector` before any extra framework.
- An agent that compares several providers or books a time.
- Sending messages for the user is never automatic: WhatsApp always opens with the draft and the user taps Send.
