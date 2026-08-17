# MAY2026-Team-041 — Community Reading Club & Library Management Platform

A web platform that digitizes community library operations - borrowing, reservations,
seat booking, reading clubs, and AI-powered recommendations - replacing paper registers
and spreadsheets.



Stack:

- Backend: FastAPI, uv, Prisma, PostgreSQL
- Frontend: React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, Framer Motion
- Testing: pytest for backend, Vitest for frontend units, Playwright for end-to-end tests
- Tooling: Ruff, ESLint, Prettier, Docker Compose

## Current Status

- **Milestone 1** (requirements) and **Milestone 2** (design & frontend) are complete.
  **Milestone 3** (backend business logic) is underway.
- The frontend has a full application shell (routing, layouts, navigation, route guards,
  light/dark theme) and every core screen built against mock data: Landing, Dashboard,
  Books, Book Details, Reservations, Events, Notifications, Profile, Reading Progress,
  Leaderboard, Reviews, Seat Booking, and an Admin Dashboard.
- The backend has moved past the scaffold stage: the `User`/`Role` schema is migrated
  (see [Database_Design.md](Database_Design.md)), a JWT + role-guard dependency exists
  (`app/api/deps.py`), and the first real endpoint — `/api/v1/members` (list/search/
  paginate, create, update; staff-only) — is implemented and tested. Everything else
  (login/register, Books, Borrowing, Seat Booking, ...) is still ahead; see
  [design-of-component.txt](design-of-component.txt) for what's built vs. planned, module
  by module.

## Repository Layout

```text
.
├── assets/                       # Diagrams and reference images (PNGs, class-diagram.mmd)
├── backend/                      # FastAPI service, Prisma schema, migrations
├── docs/                         # Spec, database design, and component design docs
│   ├── PROJECT_SPECIFICATION.md  # Product scope and architecture rules (source of truth)
│   ├── Project_Specification_V2.md
│   ├── Database_Design.md
│   ├── System_Components.md
│   ├── design-of-component.txt   # Components mapped to user stories (views/APIs/jobs)
│   └── user-identification.txt   # Primary/secondary/tertiary user identification
├── frontend/                     # React + Vite app
│   └── src/
│       ├── app/                  # Router, route guards, layouts
│       ├── components/           # ui/ primitives, layout/ shell pieces, common/ feature cards
│       ├── features/             # One folder per screen (landing, dashboard, books, ...)
│       ├── mocks/                # Mock data backing each feature until Milestone 3
│       └── providers/            # Query client, auth (mocked), theme
├── docker-compose.yml            # Local PostgreSQL
├── package.json                  # Root dev scripts (backend/frontend) and Playwright e2e
├── start_backend.py              # One-command backend starter (db + uvicorn)
└── Makefile                      # Common developer commands
```

## Prerequisites

- Python 3.12+
- uv
- Node.js 20+
- npm
- Docker

## Environment Setup

Copy the example environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

The root `.env` owns shared infrastructure values such as `DATABASE_URL`. Keep
backend-only settings in `backend/.env` so Prisma does not see duplicate database
environment variables.

Install dependencies:

```bash
make install
```

Generate the Prisma client and apply migrations (starts PostgreSQL automatically):

```bash
make db-generate
make db-migrate
```

> **Port already in use?** If you already have a local PostgreSQL instance listening on
> 5432, `docker compose` will silently bind to the wrong server and Prisma will fail with
> an authentication error. Change `POSTGRES_PORT` and `DATABASE_URL` in `.env` to an
> unused port (e.g. 5433) and re-run the steps above.

## Development

Open the app at http://localhost:5173 once both are running. Pick whichever way of
starting each one fits your workflow - they all do the same thing.

### Backend

Starts PostgreSQL (waiting until it's healthy) and then the FastAPI dev server with
auto-reload.

```bash
npm run backend          # from the repo root
```

```bash
python start_backend.py  # same thing, called directly
```

```bash
make backend-dev         # if you prefer Make
```

```bash
# fully manual, for when you want to see/control each step
docker compose up -d --wait db
cd backend
uv run uvicorn app.main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
npm run frontend            # from the repo root
```

```bash
cd frontend && npm run dev  # same thing, run directly inside frontend/
```

```bash
make frontend-dev           # if you prefer Make
```

Backend API:

- Live health: http://localhost:8000/health/live
- Readiness health: http://localhost:8000/health/ready
- Members (staff-only, needs a bearer token): http://localhost:8000/api/v1/members
- OpenAPI docs: http://localhost:8000/docs

## Quality Checks

```bash
make lint
make format
make test
```

Run Playwright tests:

```bash
make test-e2e
```

Install Playwright browsers once before the first e2e run:

```bash
npm run test:e2e:install
```

## Database

The Prisma schema lives at [backend/prisma/schema.prisma](backend/prisma/schema.prisma).
New database migrations should be committed under `backend/prisma/migrations`.

Create a migration after changing the schema:

```bash
cd backend
uv run prisma migrate dev --schema prisma/schema.prisma --name describe_change
```

Generate the Prisma Python client:

```bash
cd backend
uv run prisma generate --schema prisma/schema.prisma
```

## Production Notes

- Keep secrets out of git and provide them through the deployment environment.
- Run migrations as a release step before starting new application instances.
- Use `uv run uvicorn app.main:app --app-dir src --host 0.0.0.0 --port 8000` behind a production process manager or container runtime.
- Build the frontend with `npm --prefix frontend run build` and serve the generated `frontend/dist` through a CDN or static host.
