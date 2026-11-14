# Haddak

Mobile app for finding verified professionals and shops nearby in Lebanon. Solo founder project.

## Read first

- `docs/PROJECT.md` — the idea and every decision, with reasons
- `docs/V1_SCOPE.md` — what version 1 includes and the roadmap
- `docs/SCHEMA.md` — database schema and search ranking (source of truth)
- `docs/API.md` — contract between app and backend (source of truth)
- `docs/SYSTEM_DESIGN.md` — architecture, technology choices, security, hosting plan
- `docs/TASKS.md` — task board; update statuses as work changes
- `docs/PROGRESS.md` — dated log of what was built and how it was verified; add an entry after each milestone

Keep these docs current. When a decision, endpoint or table changes, change the doc first.

## Layout

- `backend/` — FastAPI, SQLAlchemy, Alembic, pytest
- `mobile/` — Expo (React Native, TypeScript); design system in `mobile/DESIGN.md`
- `docker-compose.yml` — local Postgres + PostGIS on port 5433

## Conventions

- The app talks only to the FastAPI backend, never to the database.
- Name is always spelled "Haddak".
- No AI features, queues or extra services until `V1_SCOPE.md` says so.
- UI work uses the installed design skills (`impeccable`, `design:*`) and follows `mobile/DESIGN.md`. No generic template look.
- The founder is stronger in Java than Python and is learning FastAPI: keep backend code plain and readable, and explain non-obvious choices in short comments.
- Never commit `.env` files or keys.

## Commands

```bash
docker compose up -d db                      # local database
cd backend && pytest                         # backend tests
cd backend && uvicorn app.main:app --reload  # backend on http://localhost:8000
cd mobile && npx expo start                  # mobile app
```
