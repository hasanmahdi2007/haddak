# Haddak — version 1 scope

## In version 1

**For people searching (no account needed)**

- Home: category grid and radius choice (500 m, 1 km, 5 km, city = 20 km), using the phone's location.
- Results: ranked list, and a map with pins. Verified, founding-member and featured badges.
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
- Approval, founding-member and featured status are set by the admin (by hand, through an admin key on the API or the database dashboard).

## Not in version 1

- AI search or chatbot
- In-app chat
- Payments, subscriptions, commission
- Third-party ads
- Admin panel app
- Booking and calendars
- App store publishing (v1 runs through Expo Go and test builds first)
- iOS-specific work beyond what Expo gives for free

## Roadmap after version 1

1. **Publish on Google Play** once the first area has enough providers.
2. **AI search.** A typed sentence in English, Arabic or mixed ("my laptop won't turn on, I'm in Haret Hreik") becomes the same category, location and radius filters. Added inside the FastAPI project.
3. **Featured placement payments**, manual first, automated later.
4. **Admin panel** for approvals and featured status.
5. **Price menus** as structured items, more photos, provider statistics page.
6. **iOS release.**
7. **Booking and commission** for bookable categories such as lessons.
8. **Queues and RAG** only when a feature needs them.
