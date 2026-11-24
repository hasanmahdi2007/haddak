# Haddak — researched ideas

Written 2026-11-16. This is a research note, not a decision record. When an idea here is adopted, record the decision in `PROJECT.md` and the scope in `V1_SCOPE.md` first.

Sources are linked inline. Where sources disagree or are weak (vendor blogs, reposts), the text says so.

---

## 1. Summary

- **Haddak's model is right for Lebanon:** free listing, contact over WhatsApp, verification by hand, and money from visibility rather than commission. Cash, low trust in banks and WhatsApp everywhere all point that way.
- **The biggest risk is still supply in one area, then low frequency of use.** Most ideas below attack one of those two.
- **The strongest wedge is power.** Solar, batteries, inverters and generators are an urgent, recurring and badly served need, and installer quality is a known problem.
- **The cheapest demand channel is WhatsApp itself.** A Haddak WhatsApp number that answers "I need an electrician in Hamra" reaches older people and people who will not install an app.
- **The diaspora is the one group that will pay for convenience** in fresh dollars, and the only place where taking a cut makes sense soon.
- **The signature feature is "Is this price fair?"** (idea 9, expanded 2026-11-24). No price dataset for tradespeople exists in Lebanon, so Haddak can own one, by region, built from a founder survey and then from real customers.

**Top 5 by impact divided by effort** (details in section 6):

1. Power first: launch as the place to find solar, battery and generator help.
2. Ask Haddak on WhatsApp: a number people message or send a voice note to.
3. "Did you hire them?" follow-up: hired-verified reviews and proof for providers.
4. Building QR and the natour: one sticker per building entrance, natour as local ambassador.
5. Maintenance reminders: turn a few-times-a-year app into a seasonal habit.

---

## 2. The Lebanese context

### 2.1 Phones, WhatsApp and older users

| Fact | Number | Source |
|---|---|---|
| Internet users | 5.38 million, 91.8% of population (Oct 2025) | [DataReportal, Digital 2026 Lebanon](https://datareportal.com/reports/digital-2026-lebanon) |
| Social media identities | 4.58 million, 78.1% | same |
| Facebook / Instagram ad reach | 3.45 million / 2.95 million | same |
| Median mobile download speed | about 44 Mbps | same |
| Android share of phones | roughly 64–69% (2026 snapshots) | [StatCounter, Lebanon](https://gs.statcounter.com/os-market-share/mobile/lebanon) |
| WhatsApp use | 98% of adults 18–29, 60% of adults 50+ (2018) | [Pew Research](https://www.pewresearch.org/short-reads/2019/11/19/protests-in-lebanon-highlight-ubiquity-of-whatsapp-dissatisfaction-with-government) |
| Population 65+ | about 10% now, about 23% by 2050 | [AARP Aging Readiness, Lebanon](https://www.aarpinternational.org/initiatives/aging-readiness-competitiveness-arc/lebanon), [L'Orient Today](https://today.lorientlejour.com/article/1266084/lebanon-faces-the-challenge-of-a-rapidly-growing-elderly-population.html) |

What this means:

- Almost everyone is online, and WhatsApp is the operating system of daily life. A [UNDP study](https://www.undp.org/sites/g/files/zskgke326/files/2024-03/undp_whatsapp_study.pdf) describes it as the tool people use to organise daily life and run businesses. It also finds trust is higher in small closed groups, where members know each other offline, than in large open ones.
- The Pew figure is old (2018) but it shows a real gap: about 4 in 10 people over 50 were not on WhatsApp then. Older people who are online often use only WhatsApp and calls. They are reachable through WhatsApp and through their children, not through app stores.
- Lebanon is ageing fast because the young emigrate. Research links youth emigration to [higher rates of older adults living alone](https://pmc.ncbi.nlm.nih.gov/articles/PMC4542589). HelpAge reports [widespread loneliness and isolation among older people](https://www.helpage.org/news/were-still-here-older-people-in-lebanon-struggle-to-recover-from-conflict-and-crisis/), with 52% not taking part in any community activity. Their children abroad are the ones who look for help on their behalf.
- Voice notes lower the literacy and typing barrier. Evidence is mostly from the Gulf: [YouGov](https://business.yougov.com/content/48604-do-consumers-prefer-sending-and-receiving-messages-in-audio-or-text-form) found UAE users the most likely of 17 markets to prefer audio messages. There is no hard Lebanese study, but voice notes are visibly common in Lebanon, and a [Harvard Misinformation Review study](https://misinforeview.hks.harvard.edu/article/audio-misinformation-on-whatsapp-a-case-study-from-lebanon/) of Lebanese WhatsApp voice notes shows how widely they travel.

### 2.2 How people find tradespeople today

There is no good survey. What the evidence shows:

- **Word of mouth and small WhatsApp groups** are the main trust channel (UNDP study above). The family group, the building group and the neighbourhood group are where "does anyone know a good electrician?" gets asked.
- **Facebook groups and Instagram.** Small businesses in Lebanon commonly [run entirely through Instagram DMs and WhatsApp](https://voxire.pages.dev/blog/how-to-start-online-business-lebanon/), with no website (vendor blog; treat as indicative). Instagram reaches about half the population (DataReportal).
- **OLX Lebanon (formerly dubizzle Lebanon)** has a [Services section](https://www.olx.com.lb/services/) with about 2,700 ads. It added phone verification after scam complaints; its manager reported [suspicious listings fell 65% in two weeks](https://www.beiruting.com/news/9734/olx-reveals-to-its-users-a-wave-of-improvements-to-secure-use-of-the-platform-in-lebanon-through-the-phone-verification-feature-). OLX is classifieds: no location ranking, no verification of skill, no reviews.
- **Google Maps** covers shops with storefronts, but not the individual technician working from a van.
- **Informality is the norm.** Informal employment rose from 55% to [over 62% of all jobs in 2022](https://www.ilo.org/resource/news/lebanon-and-ilo-release-date-data-national-labour-market) (ILO and Lebanon's statistics office). Most of Haddak's supply has no website, no registration and no online reputation. That is the gap.

### 2.3 Cash, dollars and trust

- The World Bank estimated the dollar cash economy at [about 46% of GDP in 2022](https://al-monitor.com/originals/2023/05/lebanons-tanking-economy-increasingly-cash-based-world-bank), up from 26% in 2021, driven by the loss of trust in banks.
- Only [4% of Lebanese trust financial institutions](https://news.gallup.com/poll/695462/lebanon-sees-leadership-approval-spike.aspx) (Gallup, 2025), the worst result worldwide. Trust in government and parliament [fell below 10% by 2024](https://theforum.erf.org.eg/2025/01/28/trust-in-lebanons-public-institutions-a-challenge-for-the-new-leadership/) (Arab Barometer data, ERF analysis).
- **Wallets are filling the gap.** Whish Money reports [1–2 million users](https://mena.entrepreneur.com/finance/the-finance-frontier-2026-toufic-koussa-whish-money) (company figures; sources disagree). Person-to-person transfers are its most used feature, followed by international remittances. It has partnerships with [Mastercard Move](https://www.mastercard.com/news/eemea/en/newsroom/press-releases/en/2025-1/august/whish-money-collaborates-with-mastercard-move-to-bring-seamless-cross-border-payments-to-lebanon) and [Visa](https://economymiddleeast.com/news/visa-and-whish-money-partner-to-elevate-digital-payment-solutions-across-lebanon-international-markets). OMT is the other big transfer network.
- During the 2026 war, aid moved [through digital wallets to trusted people on the ground](https://dnyuz.com/2026/04/05/with-one-million-displaced-lebanon-turns-to-digital-wallets-for-aid/) (WIRED, via repost).

What this means: payment inside Haddak is not needed for local users and would add friction. People pay the technician in cash dollars. A provider can accept a Whish transfer, so Haddak can collect its own fees by Whish or OMT. Trust in institutions is near zero, so trust has to come from people you can see: photos, real reviews, a named founder who checked the proof.

### 2.4 Electricity, generators and solar

- State power (EDL) gives a few hours a day: [about four hours on average in mid-2026](https://www.thenationalnews.com/news/mena/2026/10/14/wake-up-and-smell-the-diesel-multibillion-dollar-generators-industry-fuelling-lebanons-corruption/), down from 7–9 hours in February 2026.
- Neighbourhood generators fill the gap at high cost: over $100 a month for 5 amps in Beirut, and up to $750 for 25 amps in 2026 (same source). Human Rights Watch found a generator subscription takes [44% of the average household's monthly income](https://www.hrw.org/report/2023/03/09/cut-life-itself/lebanons-failure-right-electricity).
- Solar grew thirteenfold, [from 100 MW to 1,300 MW between 2020 and 2023](https://today.lorientlejour.com/article/1280270/lebanese-homeowners-flock-to-solar-power-amid-electricity-crisis-but-can-a-patchwork-of-panels-solve-lebanons-energy-woes.html), mostly rooftops.
- **Quality is a known problem.** Many installers were not specialists; poor installations have led to [technical issues including fires](https://today.lorientlejour.com/article/1413629/as-lebanons-solar-industry-stagnates-inexperienced-businesses-shut-down.html). The market grew ["in a legal vacuum"](https://tcf.org/content/report/building-level-cooperation-could-help-make-lebanons-solar-boom-more-equitable/), and inexperienced firms have since shut down. Their customers now need someone else to service the systems.
- **The installed base now needs servicing.** Lead-acid batteries, the cheaper and common choice, need [replacing after about three years](https://api.thepolicyinitiative.org/content/uploads/files//Eng_Report_Nisreen_Feb2026.pdf) (Policy Initiative, 2026). Dust cuts panel output, and a Lebanese study at Zahrani showed [cleaning restores power](https://www.scribd.com/document/651193171/06-Hammoud-2019). War damage also destroyed many systems: one Arabic report cites [about 400,000 damaged panels](https://attaqa.net/?p=463601).
- **There is an official trust list.** The Lebanese Center for Energy Conservation (LCEC) publishes a [list of recommended solar PV companies](https://lcec.org.lb/sites/default/files/2026-07/LCEC%20List%20of%20Recommended%20Solar%20PV%20Companies%20in%20Lebanon-July%202026.pdf), updated every two months. It covers bigger installers only, not the many small technicians who repair and maintain systems.
- **Water** has the same pattern. Average weekly network supply fell [from 49 hours in 2019 to 22 hours in 2023](https://en.wikipedia.org/wiki/Water_supply_and_sanitation_in_Lebanon). Households buy trucked water at [over $5 per 1,000 litres](https://www.al-monitor.com/originals/2025/08/water-shortages-plague-beirut-low-rainfall-compounds-woes), from unregulated trucks.

### 2.5 War, displacement and rebuilding

- The World Bank put recovery needs from the 2023–24 war at [$11 billion](https://www.worldbank.org/en/news/press-release/2025/03/07/lebanon-s-recovery-and-reconstruction-needs-estimated-at-us-11-billion), with housing the biggest share ($6.2 billion of needs, [mostly privately financed](https://institutdesfinances.gov.lb/sites/default/files/2025-04/PPT-WW%20Cost%20of%20reconstruction.pdf)).
- The 2026 escalation displaced [over a million people by April](https://dnyuz.com/2026/04/05/with-one-million-displaced-lebanon-turns-to-digital-wallets-for-aid/). An August 2026 advocacy document still counted [about 349,000 displaced](https://islamic-relief.org/wp-content/uploads/2026/08/Lebanon-Humanitarian-Advocacy.pdf).

What this means: emergency repair needs (glass, aluminium, electrics, water, generators) come in waves, and displaced families need help in towns they do not know. That is Haddak's core use: "who is good near me?". It also means launch areas must be chosen with safety in mind.

### 2.6 The diaspora

- The World Bank estimates [$5.8 billion in remittances in 2024, about 17.7% of GDP](https://today.lorientlejour.com/article/1449753/world-bank-lebanon-received-58-billion-in-remittances-in-2024.html); the central bank estimates $6.8 billion. At the 2020 peak it was 38% of GDP.
- Expats come home in summer. In July 2025 Beirut airport handled [up to 20,000 passengers a day, most of them returning Lebanese](https://thisisbeirut.com.lb/articles/1324151/summer-2025-lebanon-reclaims-its-suitcases-and-its-traffic-jams).
- Remittance and wallet apps already let expats [pay bills and top-ups for family](https://mwm.ai/apps/mol-pay/6748719188) (MOL-Pay, zaky, Purpl). **I found no app that lets an expat book and pay a vetted technician for a parent in Lebanon.** That is an open gap.

---

## 3. Competitors and analogues

### 3.1 In Lebanon

| Player | What it is | Lesson for Haddak |
|---|---|---|
| [almafraa (عالمفرق)](https://apps.apple.com/lb/app/almafraa-%D8%B9%D8%A7%D9%84%D9%85%D9%81%D8%B1%D9%82/id1438511008) | Booking app, claims 300+ home services and background checks | Closest booking-style competitor. Not known as a household name; booking apps have to own operations. |
| [Ma3ak: Home Services](https://apps.apple.com/es/app/6754034300) | New home-services marketplace (2025) | Others see the same gap. Speed in one area matters. |
| [Dale3 Baytak](https://engineerbabu.com/blog/a-mobile-app-for-service-providers) | Earlier "30+ home services" app | Wide category lists at launch did not create a habit. |
| M3allem.com | Earlier online directory of craftsmen | Press at launch said ["beyond word of mouth there is no clear source"](https://naharnet.com/stories/en/29914-m3allem-com-online-directory-for-craftsmen-in-lebanon) (the article no longer loads). The problem is old; directories alone did not solve it. |
| [OLX Lebanon](https://www.olx.com.lb/services/) | Classifieds, including about 2,700 service ads | Many service ads already exist, so supply exists. No ranking, verification or reviews. A list to recruit from. |
| [Toters](https://www.wamda.com/2022/06/lebanese-delivery-app-toters-raises-18-million-series-b-round) | Delivery super app; $18M Series B led by IFC (2022), [500,000+ customers](https://www.forbesmiddleeast.com/lists/50-most-funded-startups-2022/toters/) | Lebanese people adopt an app when it reliably works. Toters could add services one day, so Haddak's defence is local verified data. |
| [Whish Money](https://www.whish.money/about-us) | Wallet, P2P and remittances | A payment rail and possible partner, not a competitor. |

### 3.2 In the region

- **ServiceMarket (UAE)** is a services marketplace that was [acquired by e& (Etisalat) in February 2023](https://www.consultancy-me.com/news/5889/fti-advises-es-acquisition-of-uae-online-marketplace-servicemarket) after raising about $8 million. It shows a regional exit route for home services: a telecom or super app buys the demand.
- **Justlife (UAE, formerly Justmop)** runs [cleaning, beauty and maintenance](https://www.cbinsights.com/company/movesouq) as a managed service. It works in Dubai, where customers pay by card and expect booking. Lebanon's cash market fits a directory better.
- **Urban Company (India and UAE)** went public in [September 2025](https://finshots.in/archive/the-urban-company-ipo-explained-urban-clap-ipo-uc-ipo/). Analysts cite [over 80% repeat use](https://ticker.finology.in/discover/market-update/urban-company-ipo-analysis). It trains professionals in 247 classrooms, gives them insurance and tools, and [blocks partners who take customers offline](https://www.outlookbusiness.com/in-depth/the-urban-cost-of-gig-service). Lesson: a full-stack model needs heavy operations and capital, and still fights leakage.

### 3.3 Global

| Company | Model | What worked | What went wrong |
|---|---|---|---|
| Nextdoor | Neighbourhood network | [One neighbourhood at a time; 10 founding members before launch; addresses verified by hand](https://medium.com/cs183c-blitzscaling-class-collection/cs183c-session-12-nirav-tolia-nextdoor-befe631037c1) | Slow to monetise; local ads only work at density |
| Thumbtack | Customers post a job, pros pay per lead | Grew into a [$3.2B private valuation](https://productmint.com/thumbtack-business-model-how-does-thumbtack-make-money/); reportedly moved away from commission | Pros complain about [paying for leads that do not convert](https://www.housecallpro.com/resources/thumbtack-vs-takl/) (competitor source) |
| HomeAdvisor (Angi) | Sells leads to contractors | Scale | FTC [$7.2M settlement for misleading contractors about lead quality](https://techcrunch.com/2023/01/23/the-ftc-fines-homeadvisor-up-to-7-2m-for-lying-about-lead-quality-and-other-matters) |
| Bark | Pros buy credits to contact customers | Low cost to run | [Fake or stale leads and refused refunds](https://www.hellopeter.com/barkcom/reviews/warning-to-service-providers-understand-what-you-are-paying-for-on-barkcom-6430647) dominate reviews |
| Google Local Services | Pay per lead plus a ["Google Guaranteed" badge after background checks](https://www.highervisibility.com/ppc/learn/what-is-google-guarantee/) | A visible, checked badge sells; a guarantee lowers the risk of trying someone new | Expensive per lead ($25–75 in common trades) |
| TaskRabbit | Book a tasker, platform takes a cut | Demand-first launch [because taskers were plentiful](https://resources.rework.com/libraries/marketplace-growth/supply-first-vs-demand-first) | Needs card payments and insurance |
| Homejoy | Booked cleaning, platform took a cut | Fast growth with discounts | [Shut down in 2015](https://techcrunch.com/2015/07/31/why-homejoy-failed-and-the-future-of-the-on-demand-economy): poor retention, cleaners and customers [going off-platform](https://d3.harvard.edu/platform-digit/submission/homejoys-not-so-joyous-demise/index.html), expansion to 30 cities before the model worked |

### 3.4 What the record says

1. **Cold start.** Most marketplaces start with supply. Lenny Rachitsky found [14 of 17 big marketplaces seeded supply first](https://andrewchen.com/grow-marketplace-supply/amp), narrowly, in one city or niche. Andrew Chen calls the smallest self-sustaining unit the [atomic network](https://www.lennysnewsletter.com/p/atomic-network). For Haddak that is about one neighbourhood times a handful of urgent categories.
2. **Disintermediation (leakage).** If the platform charges per job, people take the relationship offline. That was Homejoy's problem, and Urban Company polices it. One study of a cleaning app found [at most 1 in 83 relationships leaked](https://www.kellogg.northwestern.edu/academics-research/research/detail/2023/a-disquieting-lack-of-evidence-for-disintermediation-in-a/), but other studies found more, and [leakage rises as commission rises](https://questromworld.bu.edu/platformstrategy/wp-content/uploads/sites/49/2023/06/PlatStrat2023_paper_27.pdf). **Haddak's answer is to not fight it.** Contact is direct by design, and money comes from visibility and tools. Leakage only matters where Haddak handles payment (the diaspora idea).
3. **Provider churn.** Pros leave when they pay and see nothing. Bark, Thumbtack and HomeAdvisor show what happens when the platform sells leads it cannot vouch for. The fix is honest numbers ("14 contacts this month") and a flat price.
4. **Trust.** Verification that people can see works: Nextdoor's addresses, Google's badge, Urban Company's training. Haddak's manual proof check is the right instinct. It now needs to be visible and backed by real hire-verified reviews.
5. **Tools keep supply.** "[Come for the tool, stay for the network](https://cdixon.org/2015/01/31/come-for-the-tool-stay-for-the-network)": give providers something useful even when Haddak sends no customers.

---

## 4. Ideas

Effort is for a solo developer with about a year of experience, on the current stack (Expo, FastAPI, Postgres): **S** is under a week, **M** is 1–3 weeks, **L** is over a month or heavy ongoing operations.

Ideas are grouped by theme. Two are marked as gimmicks. Several more are marked "later" where they only work after density.

### A. Growth and cold start

#### 1. Power first: launch as the place for solar, battery and generator help

- **What:** Launch with a narrow, deep wedge instead of "all professions". The categories are solar installer, battery and inverter repair, panel cleaning, generator electrician, small electrician, and AC repair. Add power-specific profile fields (battery types serviced, LCEC-listed yes/no, emergency call-outs) and a "Power" tile at the top of Home.
- **Why Lebanon:** State power is about four hours a day. Generators cost $100+ a month for 5 amps. Solar grew thirteenfold, but many installs were poor and some installers have gone out of business. Lead-acid batteries need replacing about every three years. The need is urgent, recurring and comes with real complaints about quality (section 2.4).
- **Effort:** S (categories, a few profile fields, Home tile). Recruiting is the real work.
- **Revenue or growth:** High intent means more contacts per provider. That means more proof to sell featured slots, and solar firms already spend on Instagram ads. It also gives Haddak a clear story for press and social media: "the trusted list for your solar".
- **Main risk:** The vertical is seasonal (summer AC, winter storms) and dominated by a few bigger firms in some areas. Mitigation: include the small repair technicians, not only installers.

#### 2. Ask Haddak on WhatsApp

- **What:** A Haddak WhatsApp Business number. People text or send a voice note ("my fridge stopped, near Hamra"). At first the founder replies by hand within minutes with three verified profile links. Later, Jarak AI parses the message and drafts the reply, and the founder approves it. Print the number on every sticker and flyer.
- **Why Lebanon:** WhatsApp is where people already ask for recommendations. Older users who rarely install apps can use it, as can their children abroad. It needs no app download, which lowers the hardest step. It also tests demand before paying for ads.
- **Effort:** S manually with the free WhatsApp Business app. M to automate with the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/pricing) plus voice-to-text. Check Meta's current per-message prices before automating.
- **Revenue or growth:** Each request is a logged demand signal by area and category, which shows where to recruit next. Each answer sends traffic to provider profiles, so stats keep counting. It is shareable: "just WhatsApp Haddak".
- **Main risk:** Founder time. It does not scale by hand past about 30 requests a day, which is a good problem. Meta's policy and pricing changes are a second risk.

#### 3. Building QR and the natour

- **What:** A laminated A5 sign for the building entrance or elevator: "Need a plumber, electrician, generator or water tank cleaner near this building? Scan: verified, rated, nearby." The QR opens Haddak centred on that building. The natour (building caretaker) is offered something small for keeping it up and recommending Haddak providers: a free featured month for a relative's business, or a small Whish payment per verified provider he brings in.
- **Why Lebanon:** In many buildings the natour is the person residents ask first. Common charges in Lebanon already cover [the concierge's fees, generator fuel and shared electricity](https://lebanon.un.org/ar/download/67476/126362), so he sits at the centre of building maintenance. Small closed groups carry the most trust (UNDP), and a building is the smallest local group there is. Nextdoor launched one neighbourhood at a time with founding members.
- **Effort:** S. A deep link with coordinates and a printable sign generator in the admin page.
- **Revenue or growth:** A physical, repeated reminder where the need happens. Each building is a small atomic network. It also leads into idea 15 (paid building plans).
- **Main risk:** Some natours take informal commissions from tradespeople, so they may push their own contacts. Not every building has a natour. Measure scans per building; drop it if scans stay near zero.

#### 4. Student area captains

- **What:** Recruit 5–10 university students, one per neighbourhood, to sign up providers face to face with the "do it for them" flow. They are paid per approved provider (for example $2–3, paid by Whish), plus a bonus when a provider gets their first contact.
- **Why Lebanon:** Supply first, narrowly, is the proven pattern (section 3.4). Students know their neighbourhoods, and the money matters to them in a cash economy. Paying per approved provider, not per sign-up, protects quality.
- **Effort:** S. A referral code on provider sign-up and a captain column in the admin page.
- **Revenue or growth:** Many times the founder's own recruiting speed in month two and three.
- **Main risk:** Fake or low-quality listings, and cash spent before revenue. Approval stays manual, and captains are paid only after approval.

#### 5. Seed from public trust lists

- **What:** Contact, one by one and with consent, providers who already appear on public lists: the [LCEC recommended solar companies](https://lcec.org.lb/sites/default/files/2026-07/LCEC%20List%20of%20Recommended%20Solar%20PV%20Companies%20in%20Lebanon-July%202026.pdf), professional orders (engineers, physicians, pharmacists), [OLX service ads](https://www.olx.com.lb/services/) in the launch area, and business Instagram accounts that tag the area. Show "LCEC listed" or "Order member" as a verification type.
- **Why Lebanon:** These are the few official trust signals that exist, and Lebanese users trust very few institutions. The supply is already advertising, just not in a ranked, local, reviewed form.
- **Effort:** S. A "verification source" field plus manual outreach.
- **Revenue or growth:** Fast credible supply in the power wedge. Listed firms are likely first buyers of featured slots.
- **Main risk:** Copying listings without consent breaks platform terms and trust; do not do it. Every profile must be created by or with the provider (the same rule as Google Maps in `PROJECT.md`).

### B. Trust

#### 6. "Did you hire them?" follow-up

- **What:** Two or three days after someone taps WhatsApp or Call, the app sends a notification (or a WhatsApp message, for idea 2 users): "Did you end up hiring Abu Ali? Yes / No / Still talking." "Yes" leads to a one-tap rating and an optional review marked **"Hired through Haddak"**. "No" asks one question: why (no answer, too expensive, not available).
- **Why Lebanon:** Trust is personal and institutions are not trusted, so reviews from real customers are the main currency. It is also the honest answer to the lead-quality fights at HomeAdvisor and Bark: Haddak can tell a provider "9 contacts, 4 confirmed jobs" instead of guessing.
- **Effort:** S. A local scheduled notification after a contact tap, plus a review flag.
- **Revenue or growth:** More and better reviews means better ranking, which means more trust. A measured hire rate is the strongest sales argument for featured placement. "No answer" data can push unresponsive providers down the ranking.
- **Main risk:** Notification fatigue. Ask once per contact, never twice.

#### 7. Quote, receipt and warranty card maker for providers

- **What:** A simple screen in the provider area that produces a branded image or PDF to send on WhatsApp. It covers a quote, a receipt and a warranty card ("battery replaced 12/2026, 6 months warranty"). Prices are in USD, with LBP shown if wanted. Each card carries the provider's Haddak QR. The customer can save the warranty in the app.
- **Why Lebanon:** Deals are cash and informal (62% informal employment), so customers have no proof of what was promised. That is a large part of the solar quality problem. Providers gain professionalism at zero cost. This is the "come for the tool" pattern: useful even with no customers from Haddak yet.
- **Effort:** M. An image template rendered on the phone, saved per provider.
- **Revenue or growth:** Every receipt is an ad for Haddak in a customer's WhatsApp. It creates price data for idea 9 and a natural "Pro" feature later (logo, unlimited cards).
- **Main risk:** Providers may not bother. Test with 10 power providers first.

#### 8. Haddak Promise (later)

- **What:** A small, clearly limited guarantee. If a Haddak-verified provider does not show up or a job must be redone within 30 days, Haddak mediates and refunds up to a cap (for example $50) from a fund paid for by featured fees. Only for providers who opt in and agree to the rules.
- **Why Lebanon:** With very low trust, a named person standing behind the list is powerful. Google uses the same idea with "Google Guaranteed".
- **Effort:** S technically; L in operations and risk.
- **Revenue or growth:** It makes "Verified" mean something, and it justifies a higher featured price.
- **Main risk:** Fraud and cash drain for a student. Only start once revenue exists, with a hard monthly cap.

#### 9. "Is this price fair?" (السعر منيح؟): the signature feature

Expanded 2026-11-24 after a talk with the founder. This is the one feature that sets Haddak apart from Toters and the booking apps. Toters brings you things; Haddak finds you the right person, at a fair price.

- **What:**
  - Every common job, per region, shows a **typical price and a middle range**. For example: "Fixing a water heater, Beirut: usually $20, most pay $15–30 (23 jobs, Sep–Nov 2026)".
  - Jarak answers "the mechanic wants $80 for brake pads, is that fair?" from the same data.
  - Businesses whose prices match what customers say get a **"Fair price" badge** and rank higher.
- **Why Lebanon:**
  - The biggest fear when calling a tradesman is being overcharged, in dollars, with no reference point.
  - Prices in central Beirut are much higher than in the South, so a national average would mislead.
  - **No dataset exists.** A search in November 2026 found no survey of what plumbers, electricians or mechanics charge in Lebanon; the results were about US towns called Lebanon. Official prices exist only for a few regulated things, such as the generator price per kWh the Energy Ministry sets every month ([L'Orient Today](https://today.lorientlejour.com/article/1546224/generator-rates-in-lebanon-at-highest-since-april.html)). Whoever collects this data first owns it, and it cannot be copied because it grows from Haddak's own customers.

**Where the data comes from, in order:**

1. **The founder's own survey (start here).**
   - Look at public price menus on business Instagram pages, and message businesses on WhatsApp for a quote like a normal customer.
   - Target: about 15 common jobs × 5 regions × 5 businesses, a few weekends of work.
   - Record each price by hand with its source and date. Never scrape Instagram automatically (its terms forbid automated collection), and never republish a business's menu image. Only the aggregated numbers are shown.
   - Shown as "Haddak survey, Dec 2026".
2. **Prices businesses post in the app** (structured prices already exist). Shown as "the business's price", separate from what customers paid.
3. **At claim time, the owner gives a price level** (the founder's idea, see below), plus prices for 3–5 common jobs if they want.
4. **Customers' answers after a job.** The "Did you hire them?" follow-up (idea 6, already built) adds one question: "How much did you pay?". This is the part that grows over time.

**Price level for shops with many items (the founder's idea):**
- A clothing shop or a mechanic cannot list every item. So the one required price step at claim is a single tap: **"Compared with similar places in your area, your prices are: below / about the same / above"**.
- Haddak shows the area's typical range next to the choice so the owner has an anchor.
- Owners will tend to pick "about the same", so the label shown is "Owner says: about the same". Once there are 5 or more customer answers, it also shows "Customers say: …".
- Owners may also add a few representative items (for example "jeans: $25") instead of a full list.
- Everything beyond this one tap stays optional. Making owners list full prices would stop them from joining.

**Stopping fake and joke answers** (the same layered approach LinkedIn uses for salaries: hard limits, then an outlier check per group; [LinkedIn Salary paper](https://arxiv.org/pdf/1703.09845)):

| Layer | Rule | Stops |
|---|---|---|
| Real customers only | Only signed-in users who contacted that business through the app can answer | Strangers and competitors |
| One answer each | One answer per user, per business, per job | One person spamming |
| Hard limits | The job is picked from a list, and the price must fall in that job's sensible range (for example a haircut is $1–100) | Joke numbers like 99999999999 |
| Median, not average | Show the median and the middle half (25th–75th percentile); drop answers far outside that range | Anything extreme that gets through |
| Minimum count | Show a range only with 5+ answers from 5+ people; otherwise "not enough data yet" or the business's own price | One person deciding the price |
| Fresh data | Use only the last 6 months, and show the dates | Old prices in a fast-moving economy |

With answers of $20, $25, $30 and $99,999,999,999, the average is useless, but the median is still $27.50.

**Regions before cities:**
- Start with 5 regions: Beirut, Mount Lebanon, North, South, Bekaa.
- Show a city or neighbourhood only once it has 5+ answers of its own.

**"The price didn't match" report:**
- After a job, a customer can say "the price was higher than listed".
- Only users who contacted that business through the app can send it, once per contact.
- The owner is told and can update their price.
- Repeated reports (for example 3+ from different people in 90 days) remove the "Fair price" badge and show a neutral line such as "Some customers paid more than the listed price".
- Never use words like "liar" or "scam": state counts, not accusations, to stay fair to owners and out of legal trouble.

- **Effort:**
  - S for the survey data and display (an aggregate query and a card).
  - M for customer answers, the price-level tap, reports and the badge.
  - The survey itself is founder time.
- **Revenue or growth:**
  - Shareable content and search traffic ("سعر بطارية ليثيوم لبنان"); journalists cite it, which brings free press.
  - Fair businesses gain ranking, which pulls more honest businesses onto Haddak.
  - It makes Jarak more useful than any search box.
- **Main risks:**
  - Thin data early: mitigated by the founder's survey and the minimum count.
  - Owners angry at being shown as "above": the label is relative and factual, and owners can respond by updating prices.
  - Prices moving with the currency: mitigated by the 6-month window and showing dates.
- **When:** after the closed test (14 days, 12 testers). Start the founder's survey during the test, since it needs no code.

### C. Older users

#### 10. Family circle

- **What:** A son or daughter (in Lebanon or abroad) adds a parent's phone with a code. The parent's Haddak opens on a "My people" screen: large photos of up to six saved providers (electrician, pharmacy, plumber, generator man), each with one huge Call button. The child manages the list remotely. Add a "Call my son to help" button.
- **Why Lebanon:** About 10% of people are over 65 now, rising to about 23% by 2050. Many live alone because their children emigrated, and 4 in 10 people over 50 were not on WhatsApp in 2018. The person choosing the technician is often the child.
- **Effort:** M. Linked accounts, a simple mode screen and remote editing of favourites (favourites already exist).
- **Revenue or growth:** It brings in the diaspora child as a user, and that is where idea 11 sells. It is also an emotional story for marketing.
- **Main risk:** Small usage numbers. Test the simple mode with 5 real older users before building the remote part.

### D. Diaspora

#### 11. Book for family from abroad

- **What:** An expat picks a verified provider for a parent's address and describes the job. They pay a fixed visit fee, or a deposit, by card or Whish. Haddak confirms with the provider and the parent by WhatsApp. The provider sends before and after photos, and the expat gets a done message. The same flow covers "ready before you land": AC service, cleaning, generator and solar check before the summer visit.
- **Why Lebanon:** Remittances are $5.8–6.8 billion a year, and expats already pay bills for family through wallets. No one sells a trusted visit. About 20,000 people a day arrive at the airport in July, most of them Lebanese from abroad. The diaspora pays in fresh dollars and values certainty over price.
- **Effort:** L. Payments, a manual operations desk and dispute handling. Start with a concierge version: a WhatsApp form, payment by Whish to the founder, and manual coordination.
- **Revenue or growth:** The one place a booking fee or 10–15% commission is justified, because Haddak adds coordination, proof and a payment rail the provider cannot offer alone. Leakage risk is lower because the expat is far away and wants the proof.
- **Main risk:** Operations load and liability if a job goes wrong. Card acceptance for a Lebanese sole trader is hard; Whish or a partner may be needed. Validate with 20 manual jobs before writing payment code.

### E. Crisis and essential services

#### 12. "Available now" and emergency mode

- **What:** Providers set "Available today" with one tap, or by replying "1" to a morning WhatsApp ping. The "open now" filter already exists; this adds availability for people without fixed hours. Admin can switch on **emergency mode** for a region during a war escalation or storm. It puts glass and aluminium, electricians, generator repair, water trucks, locksmiths and pharmacies first, shows only "available now" providers, and turns off sponsored ranking during the emergency. Water trucks get a price per 1,000 litres and a "well source stated" field.
- **Why Lebanon:** War displaced over a million people in 2026 into towns they did not know. Water and power crises come in waves, and trucked water is unregulated. Emergency numbers are already in the app; this extends them to private help.
- **Effort:** S–M. A status field with an expiry, a region flag and ranking rules.
- **Revenue or growth:** Spikes of downloads in crises, and it earns lasting goodwill. Turning ads off during emergencies is a trust statement worth saying publicly.
- **Main risk:** A stale status ("available" but not answering), so it expires daily. There is also a risk of seeming to profit from war; keep it free and ad-free.

#### 13. Rebuild and NGO contractor lists (B2B)

- **What:** A "Rebuild" group of categories (glass, aluminium, builders, electrical rewiring, waterproofing) with before and after photo galleries. Offer NGOs and municipalities running shelter repair programmes a filtered, exportable list of verified local technicians by village, for a fee or a grant partnership.
- **Why Lebanon:** Rebuilding needs are $11 billion, with housing $6.2 billion and mostly private money. The South, Nabatiyeh and Beirut's southern suburbs were hit hardest. NGOs need local, vetted contractors quickly.
- **Effort:** M (categories, galleries, a CSV export in admin). Sales to NGOs take time.
- **Revenue or growth:** One NGO contract could cover a year of running costs. It also brings supply in regions where marketing alone would not.
- **Main risk:** Slow NGO procurement and political sensitivity by region. Do not depend on it in the first 90 days; treat it as a later option.

### F. Monetisation

#### 14. Flat-price featured slots, sold out per area

- **What:** Keep the plan of featured placement at $10–20 a month, but make it scarce. Allow at most two featured slots per category per area. Sell them as 3- or 6-month prepaid packages by Whish or OMT, with a "founding" discount. Never charge per lead. Each month, send the provider the "your contacts and confirmed hires" report (ideas 6 and 7).
- **Why Lebanon:** Pay-per-lead models (Thumbtack, Bark, HomeAdvisor) create provider anger and even an FTC fine. Lebanese small businesses already pay for Instagram promotion, and prepaying in cash dollars suits the economy. Scarcity keeps the list useful to searchers.
- **Effort:** S. Featured status exists; add slot limits and expiry dates in admin.
- **Revenue or growth:** At 2 slots × 6 categories × 5 areas × $15, the ceiling is about $900 a month in year one. That is small but real, and it proves willingness to pay.
- **Main risk:** Selling before density makes featured worthless and burns trust. Sell only where searches exist (`PROJECT.md` already says this).

#### 15. Building maintenance plans (B2B)

- **What:** For building committees and property managers: one shared page for the building listing the generator contractor, elevator maintenance, water tank cleaning, solar cleaning and pest control. It has due-date reminders and a log of what was done, with receipts from idea 7. The base version is free; a paid version costs a few dollars per building per month and adds reminders to all residents plus a shared log.
- **Why Lebanon:** Buildings already share generator, electricity and concierge costs. Many now have shared solar systems: research describes [building-level solar cooperation](https://tcf.org/content/report/building-level-cooperation-could-help-make-lebanons-solar-boom-more-equitable/). Shared maintenance is a constant source of WhatsApp group arguments.
- **Effort:** M.
- **Revenue or growth:** Recurring revenue not tied to provider budgets. It also places Haddak providers into recurring jobs. It builds on idea 3.
- **Main risk:** Committees are slow to agree to pay. Start free, and charge only after 20 buildings use it actively.

### G. Cheap AI

Jarak AI already uses Claude Haiku 5.5 at about $0.10 per million input tokens and $0.50 per million output tokens (`AI_ASSISTANT.md`). At those prices, back-office jobs on a few thousand profiles cost cents.

#### 16. AI back office

- **What:** Batch jobs, never on the user's critical path:
  - turn Arabizi and mixed-language profile text into clean Arabic and English;
  - suggest categories and tags for "suggest a provider" submissions;
  - write a two-line summary of reviews once there are 5 or more;
  - flag suspicious reviews (same phrasing, same device, a burst on one day) for admin;
  - read a certificate photo and pre-fill the expiry date for the admin to confirm.
- **Why Lebanon:** Profiles mix Arabic, Arabizi, French and English. The founder is the only moderator, so his time is the bottleneck in verification.
- **Effort:** S per job.
- **Revenue or growth:** Faster approvals and cleaner profiles. Better search, because Jarak AI matches cleaner text.
- **Main risk:** Wrong summaries. Admin approves anything that is published, and the AI never decides verification on its own.

#### 17. Photo diagnosis (half-gimmick)

- **What:** "Send a photo of the problem" (an inverter error screen, a leaking pipe, a burnt socket). One vision call suggests the category and urgency, then runs the normal search.
- **Why Lebanon:** Many people do not know whether they need an electrician or an inverter technician. Inverter error codes are a real puzzle for solar owners.
- **Effort:** S–M.
- **Revenue or growth:** Modest. It routes users to the right category and works well in marketing videos.
- **Main risk:** It looks like a diagnosis and can be wrong. Treat it as a gimmick unless the data from idea 2 shows people actually send photos. It must never give repair or safety instructions.

### H. Gimmicks (named honestly)

#### 18. Points, levels and leaderboards for users (gimmick)

- **What:** Points for reviews and referrals, with "top reviewer of Achrafieh" badges.
- **Why it is a gimmick:** People need a technician a few times a year, so there is no loop to gamify. Points invite fake reviews, which damages the one asset that matters.
- **Effort:** S. **Main risk:** Review fraud. **Verdict:** Skip.

#### 19. AI voice agent that calls providers for you (gimmick for now)

- **What:** The AI phones three providers and reports who is free and their price.
- **Why it is a gimmick now:** Lebanese tradespeople answer real people and voice notes; a robot call will feel strange or rude. It is costly, legally grey, and hard to build well in Lebanese Arabic.
- **Effort:** L. **Main risk:** It annoys the providers Haddak depends on. **Verdict:** Skip. Idea 2 with a human, then AI-drafted replies, gets the same benefit.

### I. Retention

#### 20. Seasonal maintenance reminders

- **What:** When someone contacts or saves a provider in a recurring category, offer "Remind me next time": clean solar panels every 3 months, check batteries before winter, service the AC before June, clean the water tank every 6 months. The reminder opens the same provider.
- **Why Lebanon:** Dust cuts solar output, and lead-acid batteries wear out in about three years. Summer heat and expat season drive AC demand. This directly answers the "low frequency of use" risk in `PROJECT.md`.
- **Effort:** S. Local scheduled notifications, with no server work needed at first.
- **Revenue or growth:** It brings users back without ads and sends repeat jobs to the same provider. That kind of repeat use is what made Urban Company work.
- **Main risk:** Annoyance. Reminders are opt-in only, with one tap to stop.

---

## 5. All ideas at a glance

| # | Idea | Theme | Effort | Impact | Honest label |
|---|---|---|---|---|---|
| 1 | Power first | Growth, crisis | S | High | Core |
| 2 | Ask Haddak on WhatsApp | Growth, older users | S→M | High | Core |
| 3 | Building QR and the natour | Growth, B2B | S | Medium–high | Test |
| 4 | Student area captains | Cold start | S | Medium–high | Core (month 2) |
| 5 | Seed from public trust lists | Cold start, trust | S | Medium | Core |
| 6 | "Did you hire them?" | Trust, monetisation | S | High | Core |
| 7 | Quote, receipt and warranty cards | Trust, provider tool | M | Medium | Test |
| 8 | Haddak Promise | Trust | S + L ops | Medium | Later |
| 9 | "Is this price fair?" | Trust, growth | S→M | High | Signature (after closed test; survey starts now) |
| 10 | Family circle | Older users, diaspora | M | Medium | Test |
| 11 | Book for family from abroad | Diaspora, revenue | L | High (if it works) | Concierge test first |
| 12 | Available now and emergency mode | Crisis | S–M | Medium–high | Core |
| 13 | Rebuild and NGO lists | Crisis, B2B | M | Medium | Later |
| 14 | Scarce flat-price featured slots | Monetisation | S | Medium | Core |
| 15 | Building maintenance plans | B2B | M | Medium | Later |
| 16 | AI back office | Cheap AI | S | Medium | Core |
| 17 | Photo diagnosis | Cheap AI | S–M | Low–medium | Half-gimmick |
| 18 | Points and leaderboards | Engagement | S | Negative | Gimmick |
| 19 | AI voice agent | AI | L | Low | Gimmick |
| 20 | Seasonal maintenance reminders | Retention | S | Medium–high | Core |

A note on what is already built: stories, follows and offer banners are fine to keep, but they only matter once an area has dense supply and repeat users. Do not spend more time on them before the metrics in section 7 move.

---

## 6. Top 5 by impact divided by effort

| Rank | Idea | Why it wins |
|---|---|---|
| 1 | **Power first** (1) | Tiny build, and it turns a vague "all professions" app into the obvious answer to Lebanon's most urgent household problem. It focuses recruiting on one atomic network. |
| 2 | **Ask Haddak on WhatsApp** (2) | Zero code to start. It reaches older users and non-installers, and it measures real demand by area before any ad spend. |
| 3 | **"Did you hire them?"** (6) | A few days of work. It produces trusted reviews and the "confirmed hires" number that makes featured placement sellable without pay-per-lead. |
| 4 | **Building QR and the natour** (3) | A sign costs about $0.30. It is a physical, local, repeated reminder where the need happens, and each building is a small closed trust group. |
| 5 | **Seasonal maintenance reminders** (20) | Small build, and it attacks the low-frequency risk directly with real seasonal needs (solar dust, batteries, summer AC). |

Next in line: student area captains (4) once the founder's own recruiting stalls, and "available now" (12) before the next crisis.

---

## 7. 90-day plan

The assumption is one launch area: a dense, relatively safe neighbourhood the founder knows, about 2 km across. For example, part of Beirut or a Mount Lebanon town with many solar rooftops.

### Days 1–30: supply in one area, demand by hand

**Build**
- Power categories and profile fields, plus a "Power" tile on Home (idea 1).
- The "Did you hire them?" notification and the "Hired through Haddak" review flag (idea 6).
- The building QR deep link and a printable sign from the admin page (idea 3).
- A "verification source" field (LCEC, professional order, shop visit) (idea 5).

**Offline**
- Recruit in person with the "do it for them" flow. Target 40 approved providers in the area, with at least 15 in the power categories.
- Contact LCEC-listed firms and OLX service advertisers in the area, one by one.
- Open the Haddak WhatsApp number (idea 2), answer by hand, and log each request in a spreadsheet: area, category, answered or not, hired or not.
- Put signs in 30 buildings, starting with the founder's own building, family and friends.

### Days 31–60: first loops

**Build**
- Seasonal reminders (idea 20).
- "Available today" with daily expiry, plus the emergency mode switch (idea 12).
- AI back office: profile cleanup and categorising suggestions (idea 16).
- The monthly provider report message with contacts and confirmed hires.

**Offline**
- Start 3–5 student area captains on adjacent streets, paid per approved provider (idea 4).
- Grow to 80 providers and 100 buildings with signs.
- Post in local Facebook and WhatsApp groups only after a search in that area returns 5 or more good options.
- Run a manual concierge test of idea 11 with 5–10 diaspora families from the founder's network.

### Days 61–90: first money and the decision

**Build**
- Featured slot limits, expiry and prepaid packages in admin (idea 14).
- If WhatsApp volume exceeds about 20 requests a day: Jarak AI drafts the replies and the founder approves.
- If the concierge test worked: a simple "book for family" request form (still no payment code).

**Offline**
- Offer founding providers the first prepaid featured packages, with their own numbers in hand.
- Publish Google Play once the area meets the bar below.
- Pick the second area from the WhatsApp request log (where demand is strongest).

### Metrics that show it is working

| Metric | Day-90 target | What a miss means |
|---|---|---|
| Approved providers in area 1 | 80+, with 5+ in each top category within 2 km | Supply problem: add captains, narrow the area |
| Searches per week in area 1 (app + WhatsApp) | 300+ | Demand or awareness problem: more signs, local groups |
| Search → contact tap rate | 25%+ | Wrong providers, missing prices or poor ranking |
| Contact → confirmed hire (of those who answer the follow-up) | 30%+ | Providers not answering: use "no answer" data in ranking |
| Providers with 3+ contacts in the month | 40%+ | Supply too spread out, or demand too low |
| Searchers returning within 30 days | 20%+ | Low frequency not solved: push reminders |
| WhatsApp concierge requests per week | 50+ | WhatsApp channel not known: promote the number |
| Building QR scans per building per month | 3+ | Drop the natour idea, keep the signs only in busy buildings |
| Providers paying for featured | 5+ | Value not proven yet: wait, do not discount further |
| Diaspora concierge jobs completed | 10 | No paid diaspora demand: shelve idea 11 |

If after 90 days providers are listed but searches stay low, the problem is demand or marketing, as `PROJECT.md` already warns. If 80 providers cannot be reached even with captains, rethink the area or the wedge before building more features.

---

## 8. Open questions to check before acting

- Current Meta prices for the WhatsApp Cloud API in Lebanon, before automating idea 2.
- Whether Whish offers merchant or payment-link accounts for a sole trader, before idea 11 or 14 goes past manual collection.
- How natours are actually paid and what they expect in return, from 10 short conversations, before scaling idea 3.
- Which launch area is safest and densest in solar rooftops under current conditions.
