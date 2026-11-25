# Haddak — "Is this price fair?" (السعر منيح؟)

Written 2026-11-24. This is the full spec of Haddak's signature feature. The short version is idea 9 in `IDEAS.md`; the decision to cover every paid service and shop is in `PROJECT.md`.

Nothing here is built yet. When a phase starts, the tables go into `SCHEMA.md` and the endpoints into `API.md` first, as usual. Sources are linked inline; where a source is weak or could not be checked, the text says so.

---

## 1. What it is and why

**What:** for every common job, per region, Haddak shows what people usually pay. One example card:

> **Fixing a water heater element, Beirut**
> Usually **$20**. Most pay **$15–30**.
> 23 customers, Jun–Nov 2026.

And the assistant Jarak answers questions like "the mechanic wants $80 for brake pads, is that fair?" from the same numbers.

**Why Lebanon needs it:**

- **Prices are in dollars, and nobody has a reference point.** Since the crisis most private prices are quoted in fresh dollars. The old LBP prices people remember mean nothing now, and prices moved again with every fuel and exchange shock.
- **The biggest fear when calling a tradesman is being overcharged.** You call a plumber you do not know, he names a number, and you have no idea if it is normal.
- **Prices differ a lot by region.** A haircut or a plumber visit in central Beirut costs more than in the South or the Bekaa. A national average would mislead everyone.
- **Nobody has this data.** See section 2.4.

**The positioning in one line:** Toters brings you things; Haddak finds you the right person, at a fair price.

**What it is not:**

- It is not a price list that businesses must follow. Haddak shows what people pay, not what anyone should charge.
- It never calls a business a liar or a scammer (section 3.8).
- It never shows one person's price as "the price". Every number needs at least 5 answers (section 3.2).

---

## 2. Will it work?

### 2.1 The same idea works elsewhere

| Who | How they get price data | What Haddak takes from it |
|---|---|---|
| **HomeAdvisor True Cost Guide** (US) | Built from costs that homeowners report after a project. The site claims 400+ project types, 2M+ reported costs, 10,000+ US cities, updated daily ([homeadvisor.com/cost](https://www.homeadvisor.com/cost)). | Customer-reported prices for named jobs, shown per place, are a proven product. HomeAdvisor's figures are its own marketing claims, and the page refused automated access when checked, so they are quoted as the site states them. |
| **GasBuddy** (US, Canada) | Drivers report pump prices. It rewards reports with points and prize draws, and grows by network effects: more drivers means fresher prices, which brings more drivers. NPR reported about 500,000 price reports a day ([LAist / NPR](https://laist.com/news/npr-news/finding-cheaper-gas-with-your-smartphone)). A Harvard digital-platforms student essay notes the risk that contributions fade once the novelty and rewards wear off ([Harvard D3](https://d3.harvard.edu/platform-digit/submission/gasbuddy-a-platform-for-crowdsourced-gas-price-data/)). | Crowdsourcing works when answering is quick and the user sees the value. The Harvard piece is a student essay, so treat it as an informed opinion, not research. Haddak does not use points (they invite fake answers, see idea 18 in `IDEAS.md`); it asks once, right after a real job. |
| **LinkedIn Salary** | Members submit salaries. The engineering paper describes filtering in stages: hard sanity limits first, then bounds from official statistics, then a box-and-whisker outlier check inside each group (job title × region), and insights only once a group has enough entries ([LinkedIn Salary paper, arXiv 1703.09845](https://arxiv.org/pdf/1703.09845)). | The same layered filter, adapted: hard limits per job, then an outlier check per job × region, then a minimum count (section 3.7). |
| **PayScale** | Reportedly removes outliers and checks how many entries come from one person ([G2 discussion](https://www.g2.com/discussions/5748-validation-of-data)). | One answer per person per business per job. The G2 thread is unofficial; PayScale's own method is not public in detail. |

### 2.2 What already exists in Lebanon

- **No price dataset for tradespeople.** A search in November 2026 for what plumbers, electricians or mechanics charge in Lebanon found nothing; the results were about US towns called Lebanon.
- **Official prices exist only for a few regulated things:**

| What | Who sets it | How often | Source | Use in Haddak |
|---|---|---|---|---|
| Medicines | Ministry of Public Health (MOPH) "Drugs Public Price List", with the Lebanon National Drugs Database | Re-issued with the exchange rate. When checked on 2026-11-24, the newest list was "updated on 19/11/2026" under the exchange rate issued on 11/11/2026 | [MOPH Drugs Public Price List](https://www.moph.gov.lb/en/DynamicPages/index/3/37424/drugs-public-price-list-) | Link from every pharmacy page. Never survey, never copy the list into Haddak. |
| Generator electricity, per kWh | Ministry of Energy and Water | Every month. Operators in remote areas may add up to 10% (as reported; verify) | [L'Orient Today](https://today.lorientlejour.com/article/1546224/generator-rates-in-lebanon-at-highest-since-april.html) and the monthly L'Orient Today generator-tariff articles | A monthly tariff card in the Power group (idea 21 in `IDEAS.md`). |
| Fuel (gasoline, diesel) and gas cylinders | Ministry of Energy and Water | Weekly price table (verify the exact schedule) | The ministry's published table, reported by the press each week | Fuel station and gas cylinder pages show the official price. **Verify before use.** |
| Arabic bread bundle | Ministry of Economy and Trade (price and weight) | When the ministry changes it | Ministry announcements (verify) | Bakery pages show the official bundle price. **Verify before use.** |
| Prepaid phone recharge (Alfa, touch) | Ministry of Telecommunications | When changed | Operator and ministry announcements (verify) | Phone shop pages show the official card prices. **Verify before use.** |

The generator figures as found: about **$0.45 per kWh for July 2026** bills (LBP 40,746), and later in 2026 about **$0.54 per kWh** (LBP 48,241), the highest since April. L'Orient Today refused automated access when checked, so these figures come from search-result summaries of its articles. Check the current month's article before showing any number.

**Medicine delivery: never.** In June 2026 the Lebanese Order of Pharmacists warned people against buying medicine through delivery apps, saying the licensed pharmacy is the safe place and the pharmacist is legally and professionally responsible for the sale ([An-Nahar](https://www.annahar.com/lebanon/315891/%D9%86%D9%82%D8%A7%D8%A8%D8%A9-%D8%B5%D9%8A%D8%A7%D8%AF%D9%84%D8%A9-%D9%84%D8%A8%D9%86%D8%A7%D9%86-%D8%AA%D8%AD%D8%B0%D8%B1-%D9%85%D9%86-%D8%B4%D8%B1%D8%A7-%D8%A7%D9%84%D8%A3%D8%AF%D9%88%D9%8A%D8%A9-%D8%B9%D8%A8%D8%B1-%D8%AA%D8%B7%D8%A8%D9%8A%D9%82%D8%A7%D8%AA-%D8%A7%D9%84%D8%AA%D9%88%D8%B5%D9%8A%D9%84-%D8%A7%D9%84%D8%AF%D9%8A%D9%84%D9%8A%D9%81%D8%B1%D9%8A)). Al-Modon reported on 2 June 2026 that the Order was pursuing pharmacies selling through delivery ([Al-Modon](https://www.almodon.com/economy/2026/06/02/%D9%86%D9%82%D8%A7%D8%A8%D8%A9-%D8%A7%D9%84%D8%B5%D9%8A%D8%A7%D8%AF%D9%84%D8%A9-%D8%AA%D9%84%D8%A7%D8%AD%D9%82-%D8%B5%D9%8A%D8%AF%D9%84%D9%8A%D8%A7%D8%AA-%D8%AA%D8%A8%D9%8A%D8%B9-%D8%A7%D9%84%D8%A3%D8%AF%D9%88%D9%8A%D8%A9-%D8%B9%D8%A8%D8%B1-%D8%A7%D9%84%D8%AF%D9%8A%D9%84%D9%8A%D9%81%D8%B1%D9%8A)). The articles describe a warning and enforcement against pharmacies; I did not find the exact legal text. Either way the rule for Haddak is simple: **Haddak never adds medicine delivery or medicine prices of its own.** A pharmacy page shows the pharmacy, its hours, and a link to the MOPH list.

### 2.3 Honest verdict

**It works if three things hold:**

1. **The cold start is solved by the founder's survey.** Customer answers take months to reach 5 per job per region. The survey (section 6) gives a usable first number for the most-asked jobs before any customer answers.
2. **Data is gated to real customers.** Only people who contacted that business through the app and said they hired it can answer. This is what keeps competitors, owners and jokers out, and it already exists: the `hire_checks` table.
3. **Regions, not national averages.** Five regions from day one; cities only when they have their own 5+ answers.

**Main risks and what answers them:**

| Risk | How likely | What answers it |
|---|---|---|
| Thin data: most job × region cells stay empty for months | High | Founder survey first; "not enough data yet" instead of a weak number; start with the ~40 most-asked jobs, not all of them |
| People stop answering ("how much did you pay?" fatigue), the GasBuddy fade | Medium | One optional question, only after "Yes, I hired them", one tap to skip; show the user the number their answer helped build |
| Owners angry at "above" or at the badge going to a competitor | Medium | Relative, factual labels; owner can always state their own price; no accusatory words; badge rules public |
| Fake answers (owner's friends, competitors) | Medium | Real customers only, one answer each, hard limits, median, minimum count (section 3.7) |
| Prices move with fuel and currency | High in Lebanon | 6-month window, dates on every number, official prices updated by hand each month or week |
| Jobs are not comparable (cheap pads vs original pads, a 1-room vs 3-room paint job) | High | Narrow, defined jobs ("front brake pads, common sedan, fitted") and a wide middle range instead of one exact price |
| Legal: a business disputes a number | Low | Only aggregates, never one customer's answer; neutral wording; owner can respond |

---

## 3. The design

### 3.1 The number Haddak shows

For one **job** (for example `plumber.unblock-sink`) in one **region**:

- **Usually:** the median (the middle answer).
- **Most pay:** the middle range, from the 25th to the 75th percentile. Half of all answers fall inside it.
- **How many and when:** "23 customers, Jun–Nov 2026" (the count, and the months of the oldest and newest answer used).

All amounts are compared in US dollars. Answers in LBP are converted when saved, at the rate in settings (`LBP_PER_USD`, today the Banque du Liban rate of 89,500; verify before launch), and the original amount and currency are kept.

### 3.2 Display rules

| Rule | Value |
|---|---|
| Minimum to show a range | 5+ answers from 5+ different people (customers), or 5+ different businesses (survey) |
| Window | Last 6 months only. Older answers stay in the table but are not used |
| Dates | Always shown under the number |
| Not enough data | Show "Not enough prices yet" (ما في أسعار كفاية بعد) and the business's own posted price if it has one |
| Order of sources | 1. Customers (5+) → 2. Haddak survey (5+) → 3. the business's own price → 4. "Not enough prices yet". Sources are never mixed into one median, because a quoted price and a paid price are different things |
| Survey label | "Haddak survey, Dec 2026 · 25 businesses" |
| Customer label | "What customers paid · 23 customers, Jun–Nov 2026" |
| Business label | "The business's price" (never presented as a fair-price figure) |
| Region | The business's region (section 4). A city or neighbourhood is shown instead only once it has 5+ answers of its own |
| Rounding | Whole dollars above $10; to $0.50 below $10; to $0.05 below $1 (bread, copies) |

### 3.3 Where it appears

- **Provider profile:** under the business's own price, one line: "In Beirut most people pay $15–30 for this" for the business's main job.
- **Category screen:** a small "Usual prices here" strip with the category's jobs for the user's region (tap to see all).
- **Jarak:** answers price questions (3.4).
- **Public price pages (phase 3):** `haddak.app/prices/plumber/unblock-sink/beirut`, served by the backend like `/privacy`, for search traffic ("سعر تسليك مجلى بيروت").

### 3.4 Jarak: "is $80 fair for brake pads?"

1. The AI only extracts: the job (from the category's job list and aliases), the amount, the currency, and the place if given. It never invents a price. Without a clear job it asks one short question ("Front pads or rear? Fitted or only the part?").
2. The backend looks up the job and region (from the named place, else the phone's location) and applies the display rules above. The number comes from the database, never from the model.
3. The answer is plain and never accusing:
   - Inside the range: "That's normal. In Beirut most people pay $40–70 for front brake pads, fitted (12 customers, Jun–Nov 2026)."
   - Above: "That's above what most people pay. In Beirut most pay $40–70 (12 customers, Jun–Nov 2026). It can depend on the car and the brand of pads, so it's worth asking which pads he's using. Here are 3 mechanics near you with posted prices."
   - Below: "That's below the usual range ($40–70). Good price; you could ask which pads they use."
   - No data: "I don't have enough prices for this in Beirut yet. Here are mechanics near you who post their prices."
4. This needs a new response kind (`price_check`) in `API.md` and `AI_ASSISTANT.md` before it is built. The extra AI cost is the same single small call Jarak already makes.

### 3.5 The "Fair price" badge

A business gets the badge when **all** of these hold:

1. It is `verified`, or claimed by its owner.
2. At least **3 hired customers** (3 different people) reported prices for it in the last 6 months.
3. Each of those answers is compared with its job's range in the business's region (the range must exist, 5+ answers). At least **two thirds** are at or below the 75th percentile.
4. It has no active mismatch flag (3.8).

The badge is computed, never sold and never set by hand. It disappears on its own when a rule stops holding. It gives a small ranking boost, defined in `SCHEMA.md` when built; it never lifts an unverified listing above a verified one, and never overrides "verified first". Official-price categories (5.G), quote-only services (5.H), NGOs and hospitals (5.I), lawyers and accountants never get the badge; health categories (5.B) not by default.

### 3.6 "Owner says" and "Customers say": the price level

Clothing shops, mechanics and supermarkets cannot list every price. So:

- **One required tap when claiming or creating a business:** "Compared with similar places in your area, your prices are: **below / about the same / above**." (أرخص / متل غيري / أغلى). Haddak shows the area's typical range for the category's main job next to the choice, as an anchor, when there is one.
- **Everything else is optional:** prices for 3–5 common jobs, or a few representative items ("jeans: $25"). Forcing full price lists would stop owners from joining.
- **On the profile:** "Owner says: about the same". Owners will mostly pick "about the same", which is why the label names who said it.
- **Customers say:** once the business has 5+ customer answers in 6 months, each answer is placed against its job's regional range (below the 25th percentile = below; 25th–75th = about the same; above the 75th = above), and the most common of the three is shown: "Customers say: about the same".
- If owner and customers disagree, both lines show. Nothing else is said; the reader decides.
- The owner can change their level at any time; the change is dated.

### 3.7 Stopping fake and joke answers

| Layer | Rule | Stops |
|---|---|---|
| Real customers only | Only a signed-in user with a `hire_checks` row for that business, answered "hired", can report a price. The question appears right after "Yes" | Strangers, competitors, owners rating themselves (owners already cannot get a hire check on their own profile) |
| One answer each | One answer per user, per business, per job. A new answer replaces the old one (like reviews) | One person spamming |
| Hard limits | The job is picked from a list. The amount must fall in that job's sanity range (section 5), else the app says "That looks off, please check the amount" | Typos and joke numbers like 99,999,999,999 |
| Median, not average | Show the median and the 25th–75th percentile. From 10 answers up, also drop answers outside the Tukey fences (below Q1 − 1.5 × IQR or above Q3 + 1.5 × IQR) for that job and region, the box-and-whisker check LinkedIn uses. Below 10 answers the fences are unstable, so only the hard limits apply | Extreme answers that pass the hard limits |
| Minimum count | 5+ answers from 5+ different people before any range shows | One person deciding "the price" |
| Freshness | Last 6 months only; dates always shown | Old prices in a fast-moving economy |
| Founder review | Admin page lists answers that hit a hard limit or a fence, and businesses with sudden bursts of answers | Organised faking |

**Why median:** with answers of $20, $25, $30 and $99,999,999,999, the average is about $25 billion, which is useless. The median is still **$27.50** (the middle of $25 and $30). One joke answer cannot move it.

### 3.8 "The price didn't match" report

- On a profile that shows a price (the business's own, or a price level), a user can say: "The price was higher than shown" (السعر طلع أغلى من المكتوب).
- **Who:** only users with a `hire_checks` row for that business (they contacted it through the app). **Once per contact** (one report per hire check).
- **What it asks:** which job (optional), what was shown (pre-filled), what they were asked to pay (optional), a note of up to 300 characters (optional).
- **The owner is told** in My business: "A customer said the price was higher than shown. You can update your prices." The owner sees the job and amounts, never the customer's identity.
- **Threshold:** 3+ reports from 3+ different people in 90 days:
  - the "Fair price" badge is removed;
  - the profile shows a neutral line: "Some customers paid more than the listed price" (بعض الزباين دفعوا أكتر من السعر المكتوب);
  - the line goes away when the 90-day count drops below 3, or when the owner updates the price and no new report arrives for 30 days.
- **Words never used:** liar, scam, cheat, fraud, overcharge, or anything similar, in either language. State counts, not accusations. This is fairer to owners and keeps Haddak out of defamation trouble.

---

## 4. Regions

Five regions, from the district of the nearest row in `places` to the business's location. The mapping follows Lebanon's governorates, with Nabatieh joined to the South and Baalbek-Hermel joined to the Bekaa.

| `places.district` | Region | In `places` today |
|---|---|---|
| Beirut | Beirut | yes |
| Baabda | Mount Lebanon | yes |
| Matn | Mount Lebanon | yes |
| Keserwan | Mount Lebanon | yes |
| Jbeil | Mount Lebanon | yes |
| Aley | Mount Lebanon | yes |
| Chouf | Mount Lebanon | yes |
| Tripoli | North | yes |
| Akkar | North | yes |
| Zgharta | North | yes |
| Bcharre | North | yes |
| Batroun | North | yes |
| Koura | North | not yet |
| Minieh-Danniyeh | North | not yet |
| Saida | South | yes |
| Jezzine | South | yes |
| Tyre | South | yes |
| Nabatieh | South | yes |
| Marjayoun | South | yes |
| Hasbaya | South | yes |
| Bint Jbeil | South | yes |
| Zahle | Bekaa | yes |
| West Bekaa | Bekaa | not yet |
| Rashaya | Bekaa | yes |
| Baalbek | Bekaa | yes |
| Hermel | Bekaa | yes |

That is all 26 districts. The district strings above are exactly how migration 0006 spells them ("Matn", not "Metn"). The three districts not yet in `places` must use the spelling above when they are added (or the mapping must be updated). A test should fail if any `places.district` has no region.

**Rules:**

- Store the region on `places` (a new `region` column filled by the migration), so a lookup is one join, not a code table.
- A business's region = the region of the nearest `places` row to its location. A survey row has its region written in the sheet.
- **Cities and neighbourhoods** (for example "Hamra" or "Zahle") are shown instead of the region only once they have 5+ answers of their own.
- **Known weak spot:** Dahieh (Haret Hreik, Ghobeiry) and the Matn coast are in Baabda and Matn districts, so they count as Mount Lebanon even though their prices may be closer to Beirut's. Accept it for now: the city rule above fixes it once those areas have their own 5+ answers. If data later shows a clear gap, add a sixth region ("Beirut suburbs") by changing the mapping, not the data.

---

## 5. The data sheet: what to collect for every category

This is the list of **jobs** (and reference items) for all **143 categories**. Each has a stable `job_slug`, written `category-slug.job-name`, which never changes once data exists (a renamed job gets a new slug; the old one is retired).

**Sanity ranges are deliberately wide.** They only stop typos and joke numbers. They are **not** an estimate of the real price; the survey finds that. A range of "$3–300" for unblocking a sink means "anything outside this is almost certainly a mistake", nothing more.

**Columns:**

- **Unit:** what one price is for. `visit`, `job`, `hour`, `item`, `month` (as in `providers.price_unit`), plus units that only price jobs use: `day`, `kg`, `litre`, `m2` (square metre), `metre`, `km`, `kwh`, `person`, `percent`.
- **Includes:** `all` = the total the customer paid, parts included; `labour` = work only, parts paid separately. The app's question says which ("How much for the work, without parts?").
- **Sanity (USD):** the hard minimum and maximum. A minimum of 0 means "free" is a real answer (many visits and quotes are free).

The 23 **group rows** (for example `home-repair`, `food-drink`) have no jobs of their own. A listing filed directly under a group uses its children's jobs.

Organised by price type:

| Type | Categories | Section |
|---|---|---|
| A. Trades, repairs and personal services | 37 | 5.A |
| B. Consultations (health, vets, lawyers, accountants) | 10 | 5.B |
| C. Lessons and trainers | 17 | 5.C |
| D. Food and drink (the manousheh index) | 10 | 5.D |
| E. Groceries | 6 | 5.E |
| F. Retail with many items | 25 | 5.F |
| G. Official prices | 4 (plus the bakery's bread item) | 5.G |
| H. Services with quotes only | 7 | 5.H |
| I. No price or sensitive | 4 | 5.I |
| Group rows (no jobs) | 23 | above |
| **Total** | **143** (120 + 23) | |

A full category → section index is at the end of this section (5.J). Each category is counted once; the bakery is in D and also shows one official item from G.

### 5.A Trades, repairs and personal services

Standard jobs with a clear unit. These are the core of the feature.

**Home repair** (`home-repair`)

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `plumber.visit-fee` | Visit / inspection fee (if no work is done) | visit | all | 0–150 |
| `plumber.unblock-sink` | Unblock a kitchen or bathroom sink | job | all | 3–300 |
| `plumber.replace-mixer-tap` | Replace a mixer tap (customer's tap) | job | labour | 3–150 |
| `plumber.water-heater-element` | Fix a water heater: replace the heating element | job | labour | 3–200 |
| `plumber.fix-leaking-pipe` | Fix a visible leaking pipe (small, accessible) | job | all | 5–400 |
| `plumber.install-toilet` | Install a toilet (customer's toilet) | job | labour | 10–400 |
| `electrician.visit-fee` | Visit / inspection fee | visit | all | 0–150 |
| `electrician.install-socket` | Install one wall socket | item | labour | 2–100 |
| `electrician.install-ceiling-light` | Install one ceiling light or fan | item | labour | 3–150 |
| `electrician.changeover-switch` | Install a change-over switch (state power / generator) | job | labour | 5–300 |
| `electrician.fix-short-circuit` | Find and fix a short circuit | job | all | 5–400 |
| `electrician.distribution-board` | Replace a home distribution board (~12 breakers) | job | labour | 15–600 |
| `carpenter.visit-fee` | Visit / quote fee | visit | all | 0–150 |
| `carpenter.fix-door` | Fix a sticking door, hinge or handle | job | all | 3–200 |
| `carpenter.assemble-wardrobe` | Assemble a flat-pack wardrobe (2–3 doors) | job | labour | 10–400 |
| `carpenter.interior-door` | New interior wooden door, standard, fitted | item | all | 50–1500 |
| `carpenter.kitchen-per-metre` | Kitchen cabinets, upper + lower, per linear metre | metre | all | 50–2500 |
| `ac-repair.visit-fee` | Visit / inspection fee | visit | all | 0–150 |
| `ac-repair.service-split` | Clean and service one split unit | item | all | 5–150 |
| `ac-repair.refill-gas` | Refill gas, one split unit | item | all | 10–300 |
| `ac-repair.install-split` | Install a 12,000 BTU split unit (customer's unit, standard pipe length) | job | labour | 15–400 |
| `ac-repair.uninstall-split` | Take down one split unit | job | labour | 5–200 |
| `appliance-repair.visit-fee` | Visit / inspection fee | visit | all | 0–150 |
| `appliance-repair.washer-drain-pump` | Washing machine: replace the drain pump | job | all | 10–300 |
| `appliance-repair.fridge-gas` | Fridge: refill gas | job | all | 10–300 |
| `appliance-repair.fridge-thermostat` | Fridge: replace the thermostat | job | all | 10–250 |
| `painter.per-m2` | Interior painting, walls, 2 coats, per m² of wall | m2 | labour | 0.5–30 |
| `painter.room` | Paint one room (~12 m² floor), walls and ceiling | job | labour | 20–1000 |
| `painter.waterproof-roof-per-m2` | Roof waterproofing coat, per m² | m2 | all | 2–60 |
| `locksmith.open-door` | Open a locked-out house door | job | all | 5–250 |
| `locksmith.replace-cylinder` | Replace a door lock cylinder (standard) | job | all | 5–250 |
| `locksmith.copy-key` | Copy one standard house key | item | all | 0.5–20 |
| `locksmith.car-key-remote` | Copy a car key with remote | item | all | 10–500 |
| `cleaning.hourly` | House cleaner, per hour | hour | all | 2–40 |
| `cleaning.deep-clean-apartment` | Deep clean, empty ~120 m² apartment | job | all | 20–800 |
| `cleaning.sofa` | Clean a 3-seat fabric sofa at home | item | all | 5–250 |
| `cleaning.carpet-per-m2` | Carpet wash, per m² | m2 | all | 0.5–20 |
| `pest-control.cockroach-apartment` | Cockroach spray, ~120 m² apartment | job | all | 10–400 |
| `pest-control.rodents` | Rodent treatment, apartment | job | all | 10–500 |
| `pest-control.bedbugs` | Bed bug treatment, apartment | job | all | 20–800 |
| `water-tank-cleaning.roof-tank` | Clean one roof tank (1,000–2,000 L) | item | all | 5–200 |
| `water-tank-cleaning.building-underground` | Clean a building's underground tank | job | all | 20–1000 |
| `glass-aluminium.visit-fee` | Visit / measuring fee | visit | all | 0–100 |
| `glass-aluminium.replace-glass-per-m2` | Replace clear window glass (~6 mm), per m² | m2 | all | 5–200 |
| `glass-aluminium.aluminium-window-per-m2` | New aluminium window, supplied and fitted, per m² | m2 | all | 30–600 |
| `glass-aluminium.shower-screen` | Glass shower screen, standard size, fitted | item | all | 50–2000 |
| `tiler.floor-per-m2` | Floor tiling, per m² | m2 | labour | 2–60 |
| `tiler.wall-per-m2` | Wall tiling, per m² | m2 | labour | 2–60 |
| `tiler.replace-few-tiles` | Replace a few broken tiles (customer's tiles) | job | labour | 5–300 |
| `welder.window-grille-per-m2` | Iron window protection (grille), per m² | m2 | all | 10–400 |
| `welder.small-repair` | Small welding repair (gate hinge, railing) | job | all | 5–300 |
| `welder.iron-door` | Standard single iron door, fitted | item | all | 50–3000 |
| `upholsterer.dining-chair` | Re-cover a dining chair seat, fabric included | item | all | 5–200 |
| `upholsterer.sofa-3-seat` | Re-upholster a 3-seat sofa, fabric included | item | all | 30–1500 |
| `upholsterer.foam-cushion` | New foam for one seat cushion | item | all | 3–200 |

`movers` is in 5.H (quotes only).

**Power** (`power`)

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `solar.site-visit` | Site visit and quote | visit | all | 0–100 |
| `solar.system-5kw` | Complete system: ~5 kW inverter, ~10 kWh lithium battery, panels, fitted | job | all | 1500–15000 |
| `solar.install-per-panel` | Fit one panel (customer's panel, on a roof frame) | item | labour | 3–80 |
| `batteries-inverters.diagnosis` | Inverter or battery diagnosis | visit | all | 0–100 |
| `batteries-inverters.lithium-5kwh` | Lithium (LiFePO4) battery, ~5 kWh, 48 V | item | all | 300–4000 |
| `batteries-inverters.lead-acid-200ah` | Lead-acid / gel battery, 200 Ah | item | all | 50–800 |
| `batteries-inverters.install-inverter` | Install an inverter (customer's unit) | job | labour | 10–400 |
| `solar-cleaning.per-panel` | Clean one panel | item | all | 0.2–20 |
| `solar-cleaning.rooftop-10` | Clean a 10-panel rooftop | job | all | 5–200 |

`generator` is in 5.G (official tariff) and also has repair jobs there.

**Tech repair** (`tech-repair`)

Screen and battery prices depend on the model, so phone jobs use one named reference model. Update the reference model once a year (new slug).

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `laptop-repair.diagnosis` | Check / diagnosis fee | visit | all | 0–50 |
| `laptop-repair.windows-reinstall` | Reinstall Windows, keep files if possible | job | all | 3–100 |
| `laptop-repair.fan-clean` | Clean the fan, new thermal paste | job | all | 3–100 |
| `laptop-repair.screen-labour` | Replace the screen (part separate) | job | labour | 5–150 |
| `laptop-repair.ssd-upgrade` | Fit an SSD and move the system (part separate) | job | labour | 2–80 |
| `phone-repair.screen-iphone-11` | iPhone 11 screen, non-original, fitted | job | all | 15–300 |
| `phone-repair.battery-iphone-11` | iPhone 11 battery, fitted | job | all | 10–150 |
| `phone-repair.charging-port` | Charging port, common Android phone | job | all | 5–100 |
| `phone-repair.software` | Software flash / unlock-free reset | job | all | 3–80 |
| `tv-repair.visit-fee` | Visit / check fee | visit | all | 0–100 |
| `tv-repair.backlight` | LED backlight strips, 32–55" TV | job | all | 10–300 |
| `tv-repair.power-board` | Power board, 32–55" TV | job | all | 10–300 |
| `tv-repair.wall-mount` | Wall-mount a TV (customer's bracket) | job | labour | 5–100 |

**Beauty and grooming** (`beauty`)

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `barber.haircut` | Men's haircut | job | all | 1–100 |
| `barber.beard` | Beard trim and shape | job | all | 0.5–50 |
| `barber.haircut-beard` | Haircut and beard | job | all | 1–120 |
| `barber.kids-haircut` | Child's haircut | job | all | 1–60 |
| `hair-salon.blow-dry` | Blow-dry, medium hair | job | all | 2–150 |
| `hair-salon.womens-haircut` | Women's haircut | job | all | 3–300 |
| `hair-salon.root-colour` | Root colour | job | all | 5–400 |
| `hair-salon.keratin` | Keratin treatment, medium hair | job | all | 20–1000 |
| `nail-salon.manicure` | Classic manicure | job | all | 2–100 |
| `nail-salon.pedicure` | Classic pedicure | job | all | 3–120 |
| `nail-salon.gel-hands` | Gel polish, hands | job | all | 3–150 |
| `nail-salon.acrylic-set` | Acrylic full set | job | all | 5–250 |
| `spa-massage.massage-60` | Full-body massage, 60 minutes | job | all | 10–400 |
| `spa-massage.hammam` | Hammam session | job | all | 5–300 |
| `spa-massage.facial` | Basic facial | job | all | 5–300 |

**Car services** (`car-services`)

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `mechanic.diagnosis` | Computer diagnosis (OBD) | visit | all | 0–100 |
| `mechanic.oil-change-labour` | Oil and filter change (oil and filter separate) | job | labour | 0–60 |
| `mechanic.front-brake-pads` | Front brake pads, common sedan, standard pads, fitted | job | all | 10–400 |
| `mechanic.timing-belt` | Timing belt, common sedan (kit separate) | job | labour | 20–600 |
| `car-electrician.diagnosis` | Electrical diagnosis | visit | all | 0–100 |
| `car-electrician.battery-70ah` | Car battery ~70 Ah, fitted | item | all | 30–400 |
| `car-electrician.alternator` | Alternator repair, common sedan | job | all | 10–500 |
| `car-electrician.ac-gas` | Car AC gas refill | job | all | 10–200 |
| `car-wash.exterior` | Exterior wash, sedan | job | all | 1–50 |
| `car-wash.full` | Inside and outside wash, sedan | job | all | 2–80 |
| `car-wash.detailing` | Interior detailing, sedan | job | all | 10–500 |
| `tyres.tyre-205-55-r16` | One tyre 205/55 R16, mid-range brand, fitted | item | all | 20–400 |
| `tyres.puncture` | Puncture repair | job | all | 0.5–30 |
| `tyres.balancing-4` | Balancing, 4 wheels | job | all | 2–80 |
| `tyres.alignment` | Wheel alignment | job | all | 3–100 |
| `towing.in-city` | Tow within the same city | job | all | 10–300 |
| `towing.per-km` | Tow, per km on longer trips | km | all | 0.5–15 |
| `car-rental.economy-day` | Economy car, per day (insurance as offered) | day | all | 10–300 |
| `car-rental.economy-month` | Economy car, per month | month | all | 150–3000 |

**Tailoring and shoe repair** (`tailoring`)

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `tailor.hem-trousers` | Shorten trousers | item | all | 1–40 |
| `tailor.take-in` | Take in a shirt or dress | item | all | 2–80 |
| `tailor.zip` | Replace a zip | item | all | 1–40 |
| `tailor.suit-made` | Made-to-measure suit, fabric included | item | all | 50–3000 |
| `shoe-repair.resole` | Resole men's shoes | item | all | 3–150 |
| `shoe-repair.heel-tips` | Replace heel tips | item | all | 1–40 |
| `shoe-repair.boot-zip` | Replace a boot zip | item | all | 2–60 |

**Photography** (`photography`)

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `photographer.passport-photos` | Passport / ID photos (one set) | item | all | 1–30 |
| `photographer.portrait-1h` | Portrait session, 1 hour, edited photos | job | all | 10–800 |
| `photographer.wedding-day` | Wedding, full day | job | all | 100–15000 |
| `videographer.event-half-day` | Event video, half day, edited | job | all | 50–5000 |
| `videographer.wedding-day` | Wedding video, full day, edited | job | all | 100–15000 |

**Everyday services and pets** (from `everyday-services` and `pets`)

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `laundry.wash-fold-kg` | Wash and fold, per kg | kg | all | 0.3–10 |
| `laundry.dry-clean-suit` | Dry-clean a two-piece suit | item | all | 2–50 |
| `laundry.iron-shirt` | Iron one shirt | item | all | 0.2–10 |
| `laundry.duvet` | Wash a duvet | item | all | 2–60 |
| `printing.bw-a4` | Black and white copy, A4, one page | item | all | 0.01–1 |
| `printing.colour-a4` | Colour print, A4, one page | item | all | 0.05–3 |
| `printing.spiral-binding` | Spiral binding, one document | item | all | 0.3–15 |
| `printing.business-cards-500` | 500 business cards, standard | job | all | 3–200 |
| `pet-grooming.small-dog` | Full groom, small dog | job | all | 5–200 |
| `pet-grooming.cat-bath` | Cat bath | job | all | 5–150 |
| `pet-grooming.nail-trim` | Nail trim | job | all | 1–40 |

### 5.B Consultations

Per visit or per procedure. Health prices are shown like any other price, with "Prices vary with the case; ask the clinic" under them. Health categories get **no "Fair price" badge by default**: steering someone away from needed care to save a few dollars is a real risk (open question in section 9).

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `general-practitioner.consultation` | Clinic consultation | visit | all | 3–300 |
| `general-practitioner.home-visit` | Home visit | visit | all | 5–400 |
| `pediatrician.consultation` | Clinic consultation | visit | all | 3–300 |
| `dermatologist.consultation` | Clinic consultation | visit | all | 3–300 |
| `dermatologist.laser-underarms` | Laser hair removal, underarms, one session | job | all | 5–300 |
| `dentist.checkup` | Check-up | visit | all | 0–150 |
| `dentist.cleaning` | Cleaning and scaling | job | all | 5–300 |
| `dentist.filling` | Composite (white) filling, one tooth | job | all | 5–300 |
| `dentist.extraction` | Simple extraction, one tooth | job | all | 5–300 |
| `dentist.root-canal-molar` | Root canal, one molar (crown separate) | job | all | 30–1500 |
| `dentist.zirconia-crown` | Zirconia crown, one tooth | item | all | 50–2000 |
| `optician.eye-exam` | Eye test | visit | all | 0–100 |
| `optician.single-vision-lenses` | Pair of standard single-vision lenses | item | all | 5–500 |
| `optician.contact-lenses-month` | Monthly contact lenses, one box | item | all | 5–150 |
| `medical-lab.cbc` | Complete blood count (CBC) | item | all | 1–50 |
| `medical-lab.lipid-profile` | Lipid profile | item | all | 2–100 |
| `medical-lab.vitamin-d` | Vitamin D test | item | all | 3–150 |
| `medical-lab.hba1c` | HbA1c | item | all | 2–80 |
| `medical-lab.home-draw` | Blood draw at home (fee on top of tests) | visit | all | 0–50 |
| `physiotherapist.session` | Clinic session | visit | all | 3–150 |
| `physiotherapist.home-session` | Home session | visit | all | 5–200 |
| `vet.consultation` | Clinic consultation | visit | all | 3–200 |
| `vet.rabies-vaccine` | Rabies vaccine, cat or dog | item | all | 3–100 |
| `vet.cat-spay` | Spay a female cat | job | all | 15–600 |
| `vet.dog-neuter` | Neuter a male dog, medium size | job | all | 15–800 |
| `lawyer.consultation` | First consultation, about 1 hour | visit | all | 0–1000 |
| `lawyer.lease-contract` | Draft a residential lease | job | all | 10–2000 |
| `accountant.consultation` | Consultation, about 1 hour | visit | all | 0–300 |
| `accountant.bookkeeping-month` | Monthly bookkeeping, small shop | month | all | 20–2000 |
| `accountant.tax-filing-small` | Yearly tax filing, small business | job | all | 20–3000 |

Lawyers and accountants: fees depend heavily on the case. Show ranges only, with "depends on the case" under them, and never a badge.

### 5.C Lessons and trainers

Per hour (one-to-one, at the teacher's or student's place) and per month where monthly fees are the norm.

| job_slug | Job | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `saxophone-lessons.hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `piano-lessons.hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `guitar-lessons.hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `oud-lessons.hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `piano-lessons.month-4` | 4 lessons a month | month | all | 10–600 |
| `guitar-lessons.month-4` | 4 lessons a month | month | all | 10–600 |
| `math-tutoring.hour-school` | Private lesson, school level, 1 hour | hour | all | 2–100 |
| `math-tutoring.hour-official-exams` | Brevet / Bac exam preparation, 1 hour | hour | all | 3–150 |
| `physics-tutoring.hour-school` | Private lesson, school level, 1 hour | hour | all | 2–100 |
| `physics-tutoring.hour-official-exams` | Brevet / Bac exam preparation, 1 hour | hour | all | 3–150 |
| `english-tutoring.hour` | Private lesson, 1 hour | hour | all | 2–100 |
| `french-tutoring.hour` | Private lesson, 1 hour | hour | all | 2–100 |
| `nursery.full-day-month` | Full day, per month | month | all | 30–2000 |
| `nursery.half-day-month` | Half day, per month | month | all | 20–1500 |
| `nursery.registration` | Registration fee, once | item | all | 0–1000 |
| `language-school.group-month` | Group course, per month | month | all | 10–800 |
| `language-school.private-hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `drawing-lessons.hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `painting-lessons.hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `calligraphy-lessons.hour` | Private lesson, 1 hour | hour | all | 3–150 |
| `drawing-lessons.group-month` | Group class, per month | month | all | 10–500 |
| `personal-trainer.session` | One session, 1 hour | hour | all | 3–200 |
| `personal-trainer.month-12` | 12 sessions a month | month | all | 30–2000 |
| `yoga.drop-in` | One class | item | all | 2–80 |
| `yoga.month` | Monthly membership | month | all | 10–500 |
| `martial-arts.month-kids` | Kids, per month | month | all | 5–300 |
| `martial-arts.month-adult` | Adults, per month | month | all | 5–400 |
| `driving-school.hour` | Driving lesson, 1 hour | hour | all | 5–80 |
| `driving-school.course` | Full course to the test (state fees separate) | job | all | 50–1500 |

### 5.D Food and drink: the manousheh index

One reference basket of things almost everyone buys. Each item is tied to the categories that sell it. The same item in two categories (a croissant at a café and at a bakery) gets two slugs, so each kind of place is compared with its own kind; a "basket" view can still line them up by the part after the dot.

Every food business also gets the **price level** (section 3.6), since a menu has too many items.

| job_slug | Item | Unit | Sanity (USD) |
|---|---|---|---|
| `shawarma-manakish.manousheh-zaatar` | Manousheh zaatar | item | 0.2–15 |
| `shawarma-manakish.manousheh-cheese` | Manousheh cheese (akkawi or mixed) | item | 0.3–20 |
| `shawarma-manakish.chicken-shawarma` | Chicken shawarma sandwich, regular | item | 0.5–25 |
| `shawarma-manakish.falafel-sandwich` | Falafel sandwich | item | 0.3–15 |
| `fast-food.burger-meal` | Classic burger meal (burger, fries, soft drink) | item | 2–40 |
| `fast-food.pizza-medium` | Medium margherita pizza | item | 2–40 |
| `fast-food.crispy-chicken-sandwich` | Crispy chicken sandwich | item | 1–25 |
| `restaurant.hummus` | Hummus plate | item | 1–30 |
| `restaurant.fattoush` | Fattoush | item | 1–30 |
| `restaurant.mixed-grill` | Mixed grill plate, one person | item | 4–80 |
| `cafe.espresso` | Espresso, single | item | 0.3–10 |
| `cafe.cappuccino` | Cappuccino, regular | item | 0.5–12 |
| `cafe.croissant` | Plain croissant | item | 0.3–10 |
| `bakery.croissant` | Plain croissant | item | 0.2–8 |
| `bakery.kaak` | Ka'ak (street sesame bread) | item | 0.2–8 |
| `juice-ice-cream.orange-juice-small` | Fresh orange juice, small (~250–350 ml) | item | 0.5–12 |
| `juice-ice-cream.ice-cream-2-scoops` | Ice cream, 2 scoops | item | 0.5–15 |
| `juice-ice-cream.fruit-cocktail` | Fruit cocktail, medium | item | 1–20 |
| `catering.buffet-person` | Buffet, per person (lunch or dinner) | person | 3–200 |
| `catering.mezze-tray-person` | Mezze tray, per person | person | 1–80 |
| `arabic-sweets.knefeh` | Knefeh in ka'ak (one) | item | 0.5–20 |
| `arabic-sweets.baklava-kg` | Mixed baklava, 1 kg | kg | 5–150 |
| `candy-shop.mixed-candy-kg` | Mixed candy, 1 kg | kg | 2–80 |
| `cake-shop.birthday-cake-kg` | Birthday cake, per kg | kg | 5–150 |
| `cake-shop.slice` | One slice of cake | item | 1–20 |

The **Arabic bread bundle** is an official price (5.G), shown on bakery pages.

### 5.E Groceries

A fixed reference basket, priced the same way everywhere. Each grocery business also gets the price level.

| job_slug | Item | Unit | Sanity (USD) |
|---|---|---|---|
| `supermarket.tomatoes-kg` | Tomatoes, 1 kg | kg | 0.1–10 |
| `supermarket.potatoes-kg` | Potatoes, 1 kg | kg | 0.1–8 |
| `supermarket.beef-kg` | Beef (local cut for stew), 1 kg | kg | 3–60 |
| `supermarket.chicken-kg` | Whole chicken, 1 kg | kg | 1–25 |
| `supermarket.milk-1l` | Fresh milk, 1 L | litre | 0.3–8 |
| `supermarket.eggs-12` | Eggs, 12 | item | 0.5–15 |
| `supermarket.water-gallon-20l` | Drinking water, 20 L gallon refill | item | 0.3–15 |
| `supermarket.mixed-nuts-kg` | Mixed nuts, 1 kg | kg | 3–80 |
| `mini-market.milk-1l` | Fresh milk, 1 L | litre | 0.3–8 |
| `mini-market.eggs-12` | Eggs, 12 | item | 0.5–15 |
| `mini-market.water-gallon-20l` | Drinking water, 20 L gallon refill | item | 0.3–15 |
| `greengrocer.tomatoes-kg` | Tomatoes, 1 kg | kg | 0.1–10 |
| `greengrocer.potatoes-kg` | Potatoes, 1 kg | kg | 0.1–8 |
| `greengrocer.lemons-kg` | Lemons, 1 kg | kg | 0.1–10 |
| `butcher.beef-kg` | Beef (local cut for stew), 1 kg | kg | 3–60 |
| `butcher.minced-beef-kg` | Minced beef, 1 kg | kg | 3–60 |
| `butcher.chicken-kg` | Whole chicken, 1 kg | kg | 1–25 |
| `roastery.mixed-nuts-kg` | Mixed nuts, 1 kg | kg | 3–80 |
| `roastery.arabic-coffee-kg` | Arabic coffee with cardamom, 1 kg | kg | 3–80 |
| `water-delivery.gallon-20l` | 20 L gallon refill, delivered | item | 0.3–15 |
| `water-delivery.bottles-6x1-5l` | Pack of 6 × 1.5 L bottles | item | 0.5–15 |

Produce prices move with the season. Show the month next to the number and use a **3-month window** for `*-kg` produce items (tomatoes, potatoes, lemons) instead of 6.

### 5.F Retail with many items

Price level (section 3.6) is the main signal. On top, 3 reference items per category, chosen to be common, easy to compare, and not tied to one brand. "Mid-range" means the shop's usual everyday version, not luxury and not the cheapest.

| job_slug | Item | Unit | Sanity (USD) |
|---|---|---|---|
| `clothes.jeans` | Adult jeans, everyday, mid-range | item | 3–300 |
| `clothes.basic-tshirt` | Basic plain T-shirt | item | 1–100 |
| `clothes.mens-shirt` | Men's everyday shirt | item | 3–200 |
| `kids-clothes.tshirt` | Kids' T-shirt | item | 1–60 |
| `kids-clothes.pyjamas` | Kids' pyjamas | item | 2–80 |
| `kids-clothes.jeans` | Kids' jeans | item | 2–100 |
| `shoes.sneakers` | Everyday sneakers, non-designer | item | 5–300 |
| `shoes.mens-leather` | Men's leather shoes | item | 10–400 |
| `shoes.kids-school` | Kids' school shoes | item | 5–150 |
| `bags-accessories.school-backpack` | School backpack | item | 3–150 |
| `bags-accessories.handbag` | Women's everyday handbag | item | 5–500 |
| `bags-accessories.wallet` | Leather wallet | item | 2–200 |
| `jewellery.making-charge-gram` | Making charge on 21K gold, per gram, on top of the day's gold price | item | 0.5–50 |
| `jewellery.silver-ring` | Simple silver ring | item | 2–200 |
| `jewellery.ear-piercing` | Ear piercing with studs | job | 1–80 |
| `perfume-cosmetics.refill-perfume-50ml` | Refill (copy) perfume, 50 ml | item | 1–80 |
| `perfume-cosmetics.lipstick` | Lipstick, mid-range | item | 1–80 |
| `perfume-cosmetics.sunscreen-50ml` | Sunscreen SPF 50, 50 ml | item | 2–80 |
| `hardware.cement-50kg` | Cement, 50 kg bag | item | 2–30 |
| `hardware.silicone-tube` | Silicone sealant, one tube | item | 0.5–20 |
| `hardware.padlock-50mm` | Padlock, 50 mm | item | 1–60 |
| `furniture.sofa-3-seat` | 3-seat sofa, mid-range | item | 100–5000 |
| `furniture.double-bed` | Double bed frame, mid-range | item | 80–4000 |
| `furniture.dining-table-6` | Dining table for 6 | item | 80–5000 |
| `appliance-store.washer-7kg` | Front-load washing machine, 7 kg | item | 150–2000 |
| `appliance-store.fridge-400l` | Fridge, about 400 L | item | 200–3000 |
| `appliance-store.split-ac-12000` | Split AC 12,000 BTU inverter, unit only | item | 150–2000 |
| `appliance-store.water-heater-80l` | Electric water heater, 80 L | item | 50–800 |
| `electrical-supplies.led-bulb-12w` | LED bulb, 12 W | item | 0.3–15 |
| `electrical-supplies.socket` | Wall socket, single | item | 0.3–20 |
| `electrical-supplies.breaker-16a` | Circuit breaker, 16 A | item | 1–40 |
| `paint-shop.interior-gallon` | Interior emulsion, one gallon (~3.6–4 L), mid-range local brand | item | 3–100 |
| `paint-shop.waterproofing-20kg` | Roof waterproofing coating, 20 kg | item | 10–300 |
| `paint-shop.roller-set` | Roller and tray set | item | 1–40 |
| `lighting.rechargeable-lamp` | Rechargeable LED lamp | item | 2–80 |
| `lighting.led-panel-60` | LED ceiling panel 60×60 | item | 3–100 |
| `lighting.led-strip-5m` | LED strip, 5 m | item | 2–80 |
| `curtains.per-metre` | Curtain, fabric and sewing, per metre of width | metre | 3–200 |
| `curtains.roller-blind-m2` | Roller blind, per m² | m2 | 5–200 |
| `curtains.install-window` | Fit rail and curtains, one window | job | 2–80 |
| `pet-shop.cat-litter-10l` | Cat litter, 10 L | item | 2–60 |
| `pet-shop.dry-dog-food-3kg` | Dry dog food, 3 kg, mid-range | item | 3–100 |
| `pet-shop.dry-cat-food-2kg` | Dry cat food, 2 kg, mid-range | item | 3–80 |
| `phone-shop.screen-protector` | Glass screen protector, fitted | item | 0.5–40 |
| `phone-shop.usb-c-cable` | USB-C charging cable, 1 m | item | 0.5–40 |
| `phone-shop.earbuds` | Basic wireless earbuds | item | 3–300 |
| `computer-shop.wireless-mouse` | Basic wireless mouse | item | 2–100 |
| `computer-shop.ssd-500gb` | SSD 500 GB | item | 15–300 |
| `computer-shop.entry-laptop` | Entry-level laptop (Core i3/Ryzen 3 class, 8 GB) | item | 150–2000 |
| `electronics-shop.hdmi-2m` | HDMI cable, 2 m | item | 1–40 |
| `electronics-shop.power-bank-20000` | Power bank, 20,000 mAh | item | 5–150 |
| `electronics-shop.extension-4` | Extension lead, 4 sockets | item | 1–50 |
| `car-parts.oil-filter` | Oil filter, common sedan | item | 1–60 |
| `car-parts.front-pads-part` | Front brake pads, part only, common sedan | item | 5–200 |
| `car-parts.engine-oil-4l` | Engine oil 5W-30, 4 L | item | 5–150 |
| `sports-shop.football` | Football, size 5 | item | 3–150 |
| `sports-shop.yoga-mat` | Yoga mat | item | 3–100 |
| `sports-shop.dumbbell-kg` | Dumbbells, per kg | kg | 0.5–20 |
| `florist.single-rose` | One red rose | item | 0.2–20 |
| `florist.bouquet-12-roses` | Bouquet of 12 red roses | item | 5–300 |
| `florist.table-arrangement` | Table flower arrangement | item | 5–500 |
| `party-supplies.helium-balloon` | One helium balloon | item | 0.2–30 |
| `party-supplies.birthday-decor-set` | Birthday decoration set | item | 2–200 |
| `party-supplies.candles-number` | Number candle | item | 0.2–15 |
| `bookshop.paperback-novel` | New paperback novel | item | 2–80 |
| `bookshop.kids-picture-book` | Children's picture book | item | 1–60 |
| `stationery.notebook-100` | Notebook, 100 pages | item | 0.3–20 |
| `stationery.ballpoint-pen` | Blue ballpoint pen | item | 0.05–10 |
| `stationery.a4-paper-ream` | A4 paper, 500 sheets | item | 2–40 |
| `gift-shop.printed-mug` | Printed mug | item | 1–50 |
| `gift-shop.gift-wrap` | Gift wrapping, one gift | job | 0–20 |
| `gift-shop.photo-frame` | Photo frame, 13×18 | item | 1–60 |
| `toy-shop.rc-car` | Basic remote-control car | item | 3–200 |
| `toy-shop.doll` | Basic doll | item | 1–100 |
| `toy-shop.puzzle-500` | Jigsaw puzzle, 500 pieces | item | 2–80 |

Jewellery: gold itself follows the world price each day. Haddak does not survey the gold price; it shows the making charge (مصنعية) only.

### 5.G Official prices

These are set by the state. Haddak **does not survey them** and does not compute a median. The founder enters the official figure by hand when it changes, with the source link and the date, and the app shows: "Official price, set by [ministry], [date]". Every figure here must be **verified at the source before it is shown**; the "Verify" column says what to check.

| Category | job_slug | What | Unit | Who sets it | Verify |
|---|---|---|---|---|---|
| `pharmacy` | — | Link to the [MOPH Drugs Public Price List](https://www.moph.gov.lb/en/DynamicPages/index/3/37424/drugs-public-price-list-) on every pharmacy page. No prices stored in Haddak, no survey, no delivery | — | Ministry of Public Health | Link still works; list date |
| `generator` | `generator.kwh-tariff` | Price per kWh for metered generator subscriptions | kwh | Ministry of Energy and Water, monthly | Each month's figure; whether the remote-area +10% still applies |
| `generator` | `generator.fixed-fee-5a` | Monthly fixed fee for a 5 A metered subscription | month | Ministry of Energy and Water (verify that the ministry sets this part) | Which fee components the ministry sets |
| `fuel-station` | `fuel-station.gasoline-95-20l` | 20 L of 95-octane gasoline | item | Ministry of Energy and Water, weekly table | Weekly figure and schedule |
| `fuel-station` | `fuel-station.gasoline-98-20l` | 20 L of 98-octane gasoline | item | same | same |
| `fuel-station` | `fuel-station.diesel-20l` | 20 L of diesel | item | same | same |
| `gas-cylinders` | `gas-cylinders.cylinder-10kg` | 10 kg cooking gas cylinder refill | item | Ministry of Energy and Water, weekly table | Weekly figure |
| `bakery` | `bakery.arabic-bread-bundle` | Arabic bread bundle (the official size) | item | Ministry of Economy and Trade | Current price and bundle weight |

Surveyed alongside the official figures (these are not set by the state, so they follow the normal rules):

| job_slug | What | Unit | Includes | Sanity (USD) |
|---|---|---|---|---|
| `generator.flat-5a-month` | Unmetered flat subscription, 5 A, per month | month | all | 10–500 |
| `generator.service` | Service a home or building generator (oil, filters) | job | all | 10–500 |
| `generator.repair-visit` | Repair visit | visit | all | 0–150 |
| `gas-cylinders.delivery-fee` | Delivery fee for one cylinder | item | all | 0–10 |

Phone recharge cards (Alfa, touch) also have official prices, set by the Ministry of Telecommunications. Add them to `phone-shop` the same way once verified.

### 5.H Services with quotes only

Every job is different, so collect **typical ranges or percentages**, and show them as "Usually between $X and $Y" with "Ask for a written quote" under them. No badge in phase 3.

| job_slug | What | Unit | Sanity |
|---|---|---|---|
| `movers.apartment-in-city` | Move a 2-bedroom apartment within the same city | job | $50–2000 |
| `movers.between-regions` | Move a 2-bedroom apartment to another region | job | $80–3000 |
| `movers.truck-trip` | One truck with 2 workers, one trip | job | $20–500 |
| `wedding-planner.planning-fee` | Full wedding planning fee (flat) | job | $200–20000 |
| `wedding-planner.percent` | Planning fee as a percent of the wedding budget | percent | 1–30% |
| `event-venue.wedding-per-person` | Wedding dinner, per guest | person | $10–300 |
| `event-venue.hall-evening` | Hall rental, one evening, no food | job | $50–10000 |
| `real-estate.sale-commission` | Commission on a sale, per side | percent | 0.5–10% |
| `real-estate.rent-commission` | Commission on a yearly rental, in months of rent (record as a number of months in notes and the amount for one month) | job | $20–5000 |
| `travel-agency.ticket-fee` | Service fee per ticket on top of the fare | item | $0–100 |
| `travel-agency.visa-service` | Visa application service fee (not the embassy fee) | job | $5–500 |
| `money-transfer.send-100-local` | Fee to send $100 inside Lebanon | item | $0–20 |
| `money-transfer.receive-100-abroad` | Fee to receive $100 from abroad (paid by the receiver, if any) | item | $0–20 |
| `insurance.car-compulsory` | Compulsory car insurance, one year, sedan (verify whether a set tariff applies) | item | $10–300 |
| `insurance.car-all-risk-percent` | All-risk car insurance, percent of car value per year | percent | 0.5–15% |

Percent jobs are compared as percentages, not dollars. `percent` exists only for price jobs, never for `providers.price_unit`.

### 5.I No price, or sensitive

| Category | Rule |
|---|---|
| `ngo` | No price. Label "Free" (مجاني) unless the organisation says it charges for something (a course, a fee); then the owner can post that price. Never a badge, never a price level |
| `community-centre` | Same as `ngo` |
| `food-bank` | Same as `ngo`. Never show anything that looks like a price |
| `hospital` | **Sensitive.** Only two jobs: `hospital.er-visit` (emergency visit fee before tests, visit, $0–500) and `hospital.clinic-consultation` (outpatient specialist consultation, visit, $3–500). Shown with "Fees depend on tests and insurance. In an emergency, go to the nearest hospital." Never a badge, never a price level, never "above", never a mismatch line, never shown by Jarak as a reason to choose one hospital over another in an emergency |

### 5.J Coverage index: every category

So nothing is missed. Group rows (no jobs) are in bold.

| Group | Children → section |
|---|---|
| **tech-repair** | laptop-repair A, phone-repair A, tv-repair A |
| **music-lessons** | saxophone-lessons C, piano-lessons C, guitar-lessons C, oud-lessons C |
| **tutoring** | math-tutoring C, physics-tutoring C, english-tutoring C, french-tutoring C, nursery C, language-school C |
| **doctors** | dermatologist B, dentist B, pediatrician B, general-practitioner B, pharmacy G, optician B, medical-lab B, physiotherapist B, hospital I |
| **home-repair** | plumber A, electrician A, carpenter A, ac-repair A, appliance-repair A, painter A, locksmith A, cleaning A, movers H, pest-control A, water-tank-cleaning A, glass-aluminium A, tiler A, welder A, upholsterer A |
| **power** | solar A, batteries-inverters A, generator G, solar-cleaning A |
| **art-lessons** | drawing-lessons C, painting-lessons C, calligraphy-lessons C |
| **sweets-shops** | arabic-sweets D, candy-shop D, cake-shop D |
| **beauty** | barber A, hair-salon A, nail-salon A, spa-massage A |
| **car-services** | mechanic A, car-electrician A, car-wash A, tyres A, car-parts F, driving-school C, fuel-station G, car-rental A, towing A |
| **fitness** | personal-trainer C, yoga C, martial-arts C, sports-shop F |
| **tailoring** | tailor A, shoe-repair A |
| **photography** | photographer A, videographer A |
| **food-drink** | restaurant D, shawarma-manakish D, fast-food D, cafe D, bakery D (+ official bread G), juice-ice-cream D, catering D |
| **groceries** | supermarket E, mini-market E, greengrocer E, butcher E, roastery E, water-delivery E |
| **fashion** | kids-clothes F, clothes F, shoes F, bags-accessories F, jewellery F, perfume-cosmetics F |
| **home-shops** | hardware F, furniture F, appliance-store F, electrical-supplies F, paint-shop F, lighting F, curtains F, gas-cylinders G |
| **pets** | vet B, pet-shop F, pet-grooming A |
| **everyday-services** | laundry A, printing A, money-transfer H, real-estate H, travel-agency H, lawyer B, accountant B, insurance H |
| **phones-electronics** | phone-shop F, computer-shop F, electronics-shop F |
| **events** | florist F, wedding-planner H, party-supplies F, event-venue H |
| **books-gifts** | bookshop F, stationery F, gift-shop F, toy-shop F |
| **volunteering** | ngo I, community-centre I, food-bank I |

The same, by section (each category once; the bakery is in D):

| Section | Categories |
|---|---|
| A | laptop-repair, phone-repair, tv-repair, plumber, electrician, carpenter, ac-repair, appliance-repair, painter, locksmith, cleaning, pest-control, water-tank-cleaning, glass-aluminium, tiler, welder, upholsterer, solar, batteries-inverters, solar-cleaning, barber, hair-salon, nail-salon, spa-massage, mechanic, car-electrician, car-wash, tyres, car-rental, towing, tailor, shoe-repair, photographer, videographer, laundry, printing, pet-grooming (**37**) |
| B | dermatologist, dentist, pediatrician, general-practitioner, optician, medical-lab, physiotherapist, vet, lawyer, accountant (**10**) |
| C | saxophone-lessons, piano-lessons, guitar-lessons, oud-lessons, math-tutoring, physics-tutoring, english-tutoring, french-tutoring, nursery, language-school, drawing-lessons, painting-lessons, calligraphy-lessons, personal-trainer, yoga, martial-arts, driving-school (**17**) |
| D | restaurant, shawarma-manakish, fast-food, cafe, bakery, juice-ice-cream, catering, arabic-sweets, candy-shop, cake-shop (**10**) |
| E | supermarket, mini-market, greengrocer, butcher, roastery, water-delivery (**6**) |
| F | clothes, kids-clothes, shoes, bags-accessories, jewellery, perfume-cosmetics, hardware, furniture, appliance-store, electrical-supplies, paint-shop, lighting, curtains, pet-shop, phone-shop, computer-shop, electronics-shop, car-parts, sports-shop, florist, party-supplies, bookshop, stationery, gift-shop, toy-shop (**25**) |
| G | pharmacy, generator, fuel-station, gas-cylinders (**4**) |
| H | movers, wedding-planner, event-venue, real-estate, travel-agency, money-transfer, insurance (**7**) |
| I | ngo, community-centre, food-bank, hospital (**4**) |
| Groups | 23 group rows (**23**) |
| **Total** | 37 + 10 + 17 + 10 + 6 + 25 + 4 + 7 + 4 + 23 = **143** |

**How many jobs:** about 340 jobs and reference items in total. Do **not** survey all of them at once (section 6.3 picks the first ~40).

---

## 6. The founder survey (phase 0)

### 6.1 How to collect

| Method | Good for | How |
|---|---|---|
| **Instagram menus, by hand** | Food, cafés, sweets, salons, gyms, shops that post price lists | Open the business's public page, read the price from a menu post or highlight, type it into the sheet with the post link. **Never** use a script, bot or scraper: Instagram's terms forbid automated collection. **Never** save or republish the image. |
| **WhatsApp quote, as a normal customer** | Trades, repairs, lessons, quotes | Ask a real, simple question: "How much to unblock a kitchen sink in Hamra?" Record the answer with the date. Do not book a visit you will not keep. If asked, say honestly that you are comparing prices. Do not mention Haddak in the same chat (it changes the answer); invite them to Haddak later, separately, if you want them listed. |
| **Phone call** | Older tradespeople who do not use WhatsApp much | Same as WhatsApp; write the answer down at once |
| **Visits** | Groceries, bakeries, butchers, shops in the founder's own area | Read the shelf or board, or ask. Buy something small where it feels natural |
| **Public websites with prices** | Supermarkets and shops with online price lists | Read by hand and record the link. No scraping |
| **Official sources** | Section 5.G | Link and date; not part of the survey sheet's medians |

### 6.2 What to record

One row per price in `docs/price-survey/price_survey_template.csv` (copy it to a private Google Sheet for the real work):

| Column | Meaning |
|---|---|
| `date` | When the price was seen or quoted (YYYY-MM-DD) |
| `region` | Beirut, Mount Lebanon, North, South or Bekaa |
| `area` | Town or neighbourhood, as people say it ("Hamra", "Jdeideh (Matn)") |
| `category_slug` | From section 5 |
| `job_slug` | From section 5 (must exist) |
| `business_name` | The business's name. Kept private, never shown |
| `source` | `instagram`, `whatsapp`, `phone`, `visit` or `website` |
| `source_link` | Post or page link (Instagram, website); empty for WhatsApp, phone and visits |
| `price` | The number as quoted |
| `currency` | `USD` or `LBP` |
| `unit` | The job's unit from section 5 |
| `notes` | Anything that matters: "parts extra", "price for small car", "free if they do the job" |

**Rules:**

- The filled sheet is private: it holds business names. Only the template is in the repository. In the app only aggregates appear ("Haddak survey, Dec 2026 · 25 businesses"), never one business's quote.
- One row per business per job. If a business gives a range ("$15–20"), record the middle ($17.50) and write the range in `notes`.
- If the job does not match the definition (for example the price includes parts when the job says labour only), write it in `notes` and leave it out of the medians unless it can be adjusted honestly.

### 6.3 Targets and a realistic plan

**Target per job:** 5 businesses in each of the 5 regions = 25 prices. That is the minimum count, per region.

**Be honest about the scale.** About 340 jobs × 25 = over 8,000 prices. One person cannot do that by hand, and does not need to. Start with the ~40 jobs people ask about most:

| Wave | Jobs | Why first |
|---|---|---|
| 1. Power and home (12) | `plumber.visit-fee`, `plumber.unblock-sink`, `plumber.water-heater-element`, `electrician.visit-fee`, `electrician.changeover-switch`, `electrician.fix-short-circuit`, `ac-repair.service-split`, `ac-repair.refill-gas`, `appliance-repair.fridge-gas`, `batteries-inverters.lithium-5kwh`, `solar-cleaning.rooftop-10`, `generator.flat-5a-month` | The launch wedge (idea 1 in `IDEAS.md`) and the biggest overcharging fear |
| 2. Car (6) | `mechanic.front-brake-pads`, `mechanic.oil-change-labour`, `car-electrician.battery-70ah`, `tyres.puncture`, `tyres.alignment`, `car-wash.full` | The Jarak example, common and comparable |
| 3. Manousheh index (10) | `shawarma-manakish.manousheh-zaatar`, `shawarma-manakish.manousheh-cheese`, `shawarma-manakish.chicken-shawarma`, `shawarma-manakish.falafel-sandwich`, `fast-food.burger-meal`, `fast-food.pizza-medium`, `cafe.espresso`, `cafe.cappuccino`, `juice-ice-cream.orange-juice-small`, `juice-ice-cream.ice-cream-2-scoops` | Easy from Instagram menus; very shareable content |
| 4. Personal (6) | `barber.haircut`, `hair-salon.blow-dry`, `nail-salon.manicure`, `math-tutoring.hour-school`, `english-tutoring.hour`, `dentist.cleaning` | Frequent, and teens and students care |
| 5. Grocery basket (8) | `supermarket.*` items | One visit or one website per supermarket gives all 8 |

That is 42 jobs × 25 = about 1,000 prices. Instagram menus give many prices per business (a shawarma menu covers 4 jobs at once), and one supermarket visit gives 8.

**Weekend plan (about 6 hours a day):**

| When | Work | Expected output |
|---|---|---|
| Weekend 1, Saturday | Instagram menus for wave 3 (food) in all 5 regions: about 25 places per region, ~10 minutes each | ~500 food prices |
| Weekend 1, Sunday | Grocery basket: supermarket websites by hand plus 2–3 visits locally; ask family in other regions to photograph 3 shelf prices each (their own photos, used only to type the number) | ~200 grocery prices |
| Weekend 2, Saturday morning | Send WhatsApp quote questions for waves 1 and 2 to ~60 tradespeople (12 per region), found on OLX, Instagram and OSM listings | Replies arrive over the weekend |
| Weekend 2, rest | Log replies as they come; call the ones who did not answer | ~250 trade prices (expect about half to reply) |
| Weekend 3 | Wave 4 (barbers, salons by Instagram; tutors and dentists by WhatsApp), and fill the regions that are short | ~200 prices |
| Weekend 4 | Fill gaps to reach 5 per job per region; import; check the numbers by eye | Wave 1–5 complete or clearly marked as thin |

Four weekends is the honest estimate. The North and Bekaa will be the hardest to fill; family and friends there help most. Any job × region below 5 simply shows "Not enough prices yet". That is fine.

**Refresh:** repeat waves 1–3 every 6 months (the window), or sooner after a big fuel or currency jump.

### 6.4 How it is labelled in the app

- "Haddak survey, Dec 2026 · 25 businesses" under the number (Arabic: "استطلاع حدّك، كانون الأول ٢٠٢٦ · ٢٥ محل").
- A small "How we get these prices" link explaining: Haddak asked businesses directly and read public price lists; customers' answers replace the survey as they come in.
- Survey numbers are hidden after 6 months unless refreshed.

### 6.5 Desk estimates (November 2026, awaiting founder approval)

`docs/price-survey/price_estimates_2026-11.csv` holds a first estimate for every job in section 5 (342 jobs × 5 regions = 1,710 rows), made from public web sources on 2026-11-25. Columns: `low`, `typical`, `high` (USD), `confidence`, `basis`, `notes`, `sources`, and an empty `approved` column for the founder.

- **What it is:** a starting point for the founder to approve or reject, row by row. Of the 342 Beirut rows, 9 are `high` confidence (mostly official fuel and generator prices), 31 `medium`, 302 `low`. Public Lebanese price data for trades, lessons and services barely exists (as section 2.2 expected), so most rows are informed judgment.
- **Regions:** 1,251 of the 1,710 rows come from the Beirut figure times default factors (`basis = regional-factor`: 0.95 Mount Lebanon, 0.80–0.90 North, South, Bekaa for labour and food; about 1.0 for nationally priced goods). Only 26 rows have real regional evidence.
- **What it is not:** it is not survey data and not customer data. It never appears in the app as "Haddak survey" or "What customers paid" (section 3.2). Approved rows may be used as an anchor (the range shown next to the price-level choice at claim, section 3.6), to check survey answers, and to tighten the sanity ranges. Showing them to users needs its own label and a founder decision first.
- **Spec notes found during the research:** the hall rental sanity maximum ($10,000) is below some reported prices; 5.G has no slug for Alfa/touch recharge cards; generator tariffs: the ministry sets both the kWh price and the fixed fee per amp level, and the remote-area +10% still applies (October 2026 tariff); fuel tables come out about twice a week.

---

## 7. Schema sketch (not built yet)

To be moved into `SCHEMA.md`, with migrations, when phase 1 starts. Names and details may change then.

```sql
-- The list of jobs from section 5. Reference data, inserted by a migration
-- (like categories), so the hosted database has it too.
CREATE TABLE price_jobs (
    id            SERIAL PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,              -- 'plumber.unblock-sink'; never renamed
    category_id   INTEGER NOT NULL REFERENCES categories(id),
    name_en       TEXT NOT NULL,
    name_ar       TEXT NOT NULL,
    unit          TEXT NOT NULL CHECK (unit IN ('visit', 'job', 'hour', 'item', 'month',
                                                'day', 'kg', 'litre', 'm2', 'metre', 'km',
                                                'kwh', 'person', 'percent')),
    includes      TEXT NOT NULL DEFAULT 'all' CHECK (includes IN ('all', 'labour')),
    min_amount    NUMERIC(12,2) NOT NULL CHECK (min_amount >= 0),   -- sanity range, USD
    max_amount    NUMERIC(12,2) NOT NULL,                           -- (or percent for 'percent')
    kind          TEXT NOT NULL DEFAULT 'survey'
                  CHECK (kind IN ('survey', 'official', 'quote', 'sensitive')),
    window_days   INTEGER NOT NULL DEFAULT 182,      -- 91 for seasonal produce
    active        BOOLEAN NOT NULL DEFAULT TRUE,     -- retired jobs keep their data
    sort_order    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT price_jobs_range CHECK (max_amount > min_amount)
);

-- What customers paid. Only after a "hired" answer to a hire check.
CREATE TABLE price_reports (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hire_check_id  UUID NOT NULL REFERENCES hire_checks(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL,                    -- same as the hire check's user
    provider_id    UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    price_job_id   INTEGER NOT NULL REFERENCES price_jobs(id),
    amount         NUMERIC(14,2) NOT NULL CHECK (amount >= 0),   -- as typed
    currency       TEXT NOT NULL CHECK (currency IN ('USD', 'LBP')),
    amount_usd     NUMERIC(12,2) NOT NULL,           -- converted when saved
    region         TEXT NOT NULL CHECK (region IN ('beirut', 'mount-lebanon', 'north', 'south', 'bekaa')),
    place_id       INTEGER REFERENCES places(id),    -- nearest place, for the city rule
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider_id, price_job_id)      -- one answer each; a new one replaces it
);
CREATE INDEX price_reports_job_region_time_idx ON price_reports (price_job_id, region, created_at);

-- The founder's survey, imported from the sheet by a script.
CREATE TABLE price_survey (
    id             BIGSERIAL PRIMARY KEY,
    price_job_id   INTEGER NOT NULL REFERENCES price_jobs(id),
    region         TEXT NOT NULL CHECK (region IN ('beirut', 'mount-lebanon', 'north', 'south', 'bekaa')),
    area           TEXT NOT NULL,
    business_name  TEXT NOT NULL,                    -- never returned by the API
    provider_id    UUID REFERENCES providers(id) ON DELETE SET NULL,   -- if listed on Haddak
    source         TEXT NOT NULL CHECK (source IN ('instagram', 'whatsapp', 'phone', 'visit', 'website')),
    source_link    TEXT,
    amount         NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    currency       TEXT NOT NULL CHECK (currency IN ('USD', 'LBP')),
    amount_usd     NUMERIC(12,2) NOT NULL,
    surveyed_on    DATE NOT NULL,
    notes          TEXT,
    imported_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Official prices (section 5.G), entered by the founder in the admin page.
CREATE TABLE official_prices (
    id             SERIAL PRIMARY KEY,
    price_job_id   INTEGER NOT NULL REFERENCES price_jobs(id),
    amount         NUMERIC(14,2) NOT NULL,
    currency       TEXT NOT NULL CHECK (currency IN ('USD', 'LBP')),
    effective_from DATE NOT NULL,
    source_url     TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "The price didn't match". One per hire check (once per contact).
CREATE TABLE price_mismatch_reports (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hire_check_id  UUID NOT NULL UNIQUE REFERENCES hire_checks(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL,
    provider_id    UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    price_job_id   INTEGER REFERENCES price_jobs(id),
    shown_amount   NUMERIC(14,2),
    asked_amount   NUMERIC(14,2),
    currency       TEXT CHECK (currency IN ('USD', 'LBP')),
    note           TEXT CHECK (char_length(note) <= 300),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    owner_seen_at  TIMESTAMPTZ
);
CREATE INDEX price_mismatch_provider_time_idx ON price_mismatch_reports (provider_id, created_at);

-- Owner's price level (section 3.6).
ALTER TABLE providers
    ADD COLUMN price_level TEXT CHECK (price_level IN ('below', 'same', 'above')),
    ADD COLUMN price_level_set_at TIMESTAMPTZ;

-- Region on places (section 4).
ALTER TABLE places
    ADD COLUMN region TEXT CHECK (region IN ('beirut', 'mount-lebanon', 'north', 'south', 'bekaa'));
```

**Rules that come with it:**

- **Every new table runs `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`** in its migration (`SCHEMA.md` rule; `tests/test_db_security.py` fails otherwise).
- `price_jobs` is reference data from migrations, like `categories`, so the hosted database has it. A test should check every `price_jobs.category_id` points to a non-group category and every slug starts with its category's slug.
- `DELETE /me` must also delete the user's `price_reports` and `price_mismatch_reports` (the medians simply lose those answers).
- `business_name`, `user_id` and `source_link` are never returned by public endpoints. Public endpoints return only aggregates: median, 25th and 75th percentile, count, first and last month.
- Medians are computed in the query (`percentile_cont(0.5) WITHIN GROUP (ORDER BY amount_usd)`), no background job. If it gets slow, cache per job × region for an hour.
- Whether "price level required at claim" becomes a database constraint or an API rule is decided in phase 1 (an API rule is simpler: OSM and suggested listings have no owner to ask).

---

## 8. Phases

| Phase | What | Code effort | Depends on |
|---|---|---|---|
| **0. Founder survey** | Section 6: four weekends, the sheet, no code | none (founder time) | Nothing. **Can start now** |
| **1. Show the survey and business prices** | `price_jobs` migration with the wave 1–5 jobs (more later); `price_survey` and an import script for the sheet; `places.region`; a summary endpoint (job × region); "Usual prices here" strip and profile line in the app; owner price level at claim and in My business; official prices card for generators and the MOPH link on pharmacy pages | M | Phase 0 data for waves 1–5 |
| **2. Customers' answers** | "How much did you pay?" after "Yes, I hired them" in the hire check sheet; `price_reports`; "Customers say"; the "price didn't match" report and the owner notice; admin list of flagged answers | M | Phase 1; hire checks (built) |
| **3. Badge, Jarak and public pages** | "Fair price" badge and its ranking boost; Jarak `price_check` answers; public price pages on the backend for search traffic | M (L if the public pages grow into a site) | Phase 2 with enough answers (a few months) |

Effort uses the scale in `IDEAS.md` (S under a week, M 1–3 weeks, L over a month). The official generator tariff card and the MOPH link are S each and can ship on their own before phase 1.

---

## 9. Open questions

- Which parts of the generator bill the Energy Ministry sets (kWh price only, or also a fixed fee per amp level), and whether the remote-area +10% still applies.
- The exact weekly schedule of the fuel price table, and where the official bread and recharge-card prices are published now.
- Whether the `LBP_PER_USD` rate should follow the Banque du Liban rate automatically or be set by hand.
- Whether health jobs (5.B) should ever carry a "Fair price" badge. Default: no, until the founder decides with data in hand.
- Whether Dahieh and the Matn coast need their own region once data exists (section 4).
