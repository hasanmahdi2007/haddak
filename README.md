# Haddak

**Haddak** (حدّك, "next to you") is a mobile app for finding a verified professional or shop near you in Lebanon. Pick what you need and how far you will go; get a ranked list and map of verified people with ratings and prices; contact them on WhatsApp or by phone.

Status: version 1 in development.

## How it fits together

```
 Expo app (React Native)  ──HTTPS/JSON──▶  FastAPI backend  ──SQL──▶  Postgres + PostGIS
        │                                        ▲
        └── login, photo upload ──▶ Supabase Auth / Storage (tokens verified by the backend)
```

- `mobile/` — the app
- `backend/` — the API, radius search and business rules
- `docs/` — project record, scope, schema, API contract, task board

## Run it locally

```bash
docker compose up -d db                      # database on localhost:5433
cd backend && uvicorn app.main:app --reload  # API on http://localhost:8000, docs at /docs
cd mobile && npx expo start                  # scan the QR code with Expo Go
```

Setup details are in `backend/README.md` and `mobile/README.md`.
