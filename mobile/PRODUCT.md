# Product

<!-- impeccable:product-schema 1 -->

> Source: written by the mobile subagent from `docs/PROJECT.md`, `docs/V1_SCOPE.md` and the coordinator's brief. No live interview was possible (subagent, no question tool), so nothing here goes beyond those documents. The founder should correct anything wrong.

## Platform

android

(Android first. The same Expo codebase also runs on iOS and must respect its safe areas and back gesture, but no iOS-specific design work is planned in version 1.)

## Stack

Expo (React Native, TypeScript, Expo Router). Tested through Expo Go on Android. Decided in `docs/PROJECT.md`.

## Users

People in Lebanon who need a professional or a shop near them and today ask "who knows someone": a parent looking for a tutor, someone whose laptop died, someone who needs a dermatologist or a plumber. They are on Android phones, often on mobile data, standing in their own neighbourhood, and they finish the job on WhatsApp or by phone. They read Arabic, English, or both, and switch between them.

Second audience, later in version 1: the providers themselves (individuals and small shops), who are shown their profile on the founder's phone when they are recruited.

## Product Purpose

Pick what you need and how far you are willing to go; get a ranked list of verified people with ratings and prices; contact them on WhatsApp or by phone. Success in the first area: 50+ providers listed, real searches, and providers who got clients through it.

## Positioning

The data, not the app: every provider is checked by hand before appearing (certificate or shop photo), and prices are public, which is rare in Lebanon. Individuals who live on WhatsApp and Instagram become findable by place, quality and price.

## Operating Context

- Search is two taps, with no typing: a category and a radius (500 m, 1 km, 5 km, city = 20 km).
- No account is needed to search or contact.
- Contact leaves the app: `wa.me` and `tel:` links.
- Every profile view, WhatsApp tap and call tap is counted per provider.
- Launch is one dense area first (the seed area is Haret Hreik), then expansion.
- Low frequency of use: a few times a year per person, so nothing can depend on the user remembering how the app works.

## Capabilities and Constraints

- Ranking: featured first, then rating weighted by review count, then distance (`docs/SCHEMA.md`).
- Badges: verified, founding member, featured. Featured is paid placement and must be honestly labelled as such.
- English and Arabic, with full right-to-left layout.
- No AI, chat, payments, booking or third-party ads in version 1.
- The app talks only to the FastAPI backend (`docs/API.md`).
- Not built yet: map view (M5), sign-in, provider sign-up, review writing, QR codes.

## Brand Commitments

- The name is always spelled "Haddak" (Arabic: حدّك, "next to you").
- Founder's direction: trustworthy, warm, local; a real Lebanese product, not a generic template. No default purple or blue gradients, no emoji as icons, no decorative glass, no card-on-card clutter.
- No logo or brand assets exist yet.

## Evidence on Hand

- No real providers, photos or reviews yet. All provider data, reviews and photos in the app are mock data and must not be presented outside development as real.
- The share domain `haddak.app` is not registered yet.

## Product Principles

1. Trust is shown, not claimed: verification, review counts and prices are on the card, in plain sight.
2. Two taps to a list, one more to a person. Nothing between the user and WhatsApp.
3. Arabic and English are equals; neither is a translation of the other.
4. Local before polished: place names, distances and prices the way people here say them.
5. Paid placement is always labelled.

## Accessibility & Inclusion

WCAG 2.1 AA contrast, 48 dp touch targets, screen-reader labels on every control, text that follows the system font size, and right-to-left as a first-class layout.
