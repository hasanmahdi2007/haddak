# Haddak — version 1 scope

## In version 1

**For people searching (no account needed)**

- Home: a search bar at the top (business name, kind of business or area, in Arabic, English or Arabizi), the assistant, a few category groups, "All categories" for the full tree (143 categories, 2026-11-24), and radius choice (500 m, 1 km, 5 km, city = 20 km), using the phone's location.
- Results: ranked list, 20 at a time with more loaded on scroll ("Showing 20 of N"), and a map with clustered pins. When few results are found, the app offers a wider radius. Verified, founding-member and featured badges.
- Provider profile: photos, description, price, rating, reviews, WhatsApp and Call buttons, share link.
- Leave a review (needs sign-in). One review per person per provider; it can be edited.
- English and Arabic, including right-to-left layout.

**For providers (account needed)**

- Sign in, fill in a profile, drop a pin on the map, upload proof (certificate or shop photo).
- Profile is "pending" and hidden until approved.
- Edit own profile. See this month's views and contacts.
- Shareable link and QR code for the profile.

**Behind the scenes**

- Search: providers within the chosen radius, ordered featured first, then by rating weighted by number of reviews, then by distance.
- Every profile view, WhatsApp tap and call tap is counted per provider.
- Approval, founding-member and featured status are set by the admin through a simple approval page served by the API at `/admin` (protected by the admin key).
- Text search (no AI): matches business names, category names and keywords (Arabic, English, Arabizi, small typos) and area names, alongside category and radius.
- **Assistant (added 2026-11-16):** say or type the need in your own words; one AI request turns it into a search (category, place, radius, price limit, open now). Our code searches and shows the list; WhatsApp opens with a ready message. Full rules and cost limits in `AI_ASSISTANT.md`.
- Structured prices (amount, per what, currency) so search can filter by price.
- Protection for the numbers: rate limits on write routes, and a repeated tap from the same phone counts once per 10 minutes.

## Not in version 1

- Open AI chat (the assistant in version 1 only turns a sentence into a search; see `AI_ASSISTANT.md`)
- In-app chat
- Payments, subscriptions, commission
- Third-party ads
- Full admin panel app (version 1 has only the one approval page)
- Booking and calendars
- App store publishing (v1 runs through Expo Go and test builds first)
- iOS-specific work beyond what Expo gives for free

## Roadmap after version 1

1. **Publish on Google Play** once the first area has enough providers.
2. **Assistant, next steps:** hold-to-talk button in the store build, full GeoNames place list, chat about one provider, menus with item prices (see `AI_ASSISTANT.md` → Later).
3. **Featured placement payments**, manual first, automated later.
4. **Admin panel** for approvals and featured status.
5. **Price menus** as structured items, more photos, provider statistics page.
6. **iOS release.**
7. **Booking and commission** for bookable categories such as lessons.
8. **Queues and RAG** only when a feature needs them.
