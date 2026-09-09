# MAY2026 Team 041 (Consolidated README)

This is a **single-file, shareable README** for the MAY2026 Team 041 project. You can send this file independently without requiring access to the repository structure.

---

## 1) Project Summary

**MAY2026 Team 041** is a community library management platform — a single full-stack
Next.js application (React frontend + its own API routes/services, one deployable app).

It supports:
- Role-based login and dashboards (Admin, Manager, Librarian, Member, Guardian, IT Head)
- Book catalog, borrowing, reservations, and seat booking
- Community reading club, reviews, and a leaderboard
- Fee/fine tracking and Razorpay payments for memberships
- Guardian-linked accounts for tracking a child's reading and dues
- An AI chatbot assistant, AI-generated book insights (summary/difficulty/themes),
  AI reading-level detection, a personal AI reading profile, AI-powered "similar books"
  recommendations, and staff-facing AI demand-forecast/late-return-risk insights — all
  backed by a swappable LLM provider (OpenAI, AWS Bedrock, or local Ollama)

## Screenshots

For a feel of the actual UI (landing page, dashboards, catalog, and more), see
[docs/screenshots.md](docs/screenshots.md).

---

## 2) Tech Stack and What Each Tool Is Used For

### App (frontend + its own API routes)
- **React 19** — UI framework
- **Next.js (App Router)** — dev server, build tool, file-based routing, and the
  Route Handlers that serve `/api/v1/*` (the app is its own backend — no separate
  API server)
- **Bun** — package manager and script runner
- **TypeScript** — type-safe throughout, frontend and server code alike
- **Prisma** — ORM, schema, and DB migrations (`frontend/prisma/`)
- **PostgreSQL** — primary relational database
- **Redis** — rate limiting and chatbot conversation history
- **jsonwebtoken + bcryptjs** — JWT authentication and password hashing
- **google-auth-library** — Google login token verification
- **Razorpay SDK** — payment integration for online membership fees
- **LangChain.js (+ @langchain/openai / @langchain/aws / @langchain/ollama /
  @langchain/langgraph)** — unified interface to the configured LLM provider, used by
  the chatbot (a LangGraph ReAct agent), book insights, reading-level detection,
  reading profiles, embedding-based "similar books", and manager AI insights
- **TanStack Query** — server-state caching/fetching
- **React Hook Form + Zod** — form state and validation (Zod also validates every API
  route's request/response shapes server-side)
- **Tailwind CSS v4** — utility-first styling
- **Framer Motion** — animation
- **i18next / react-i18next** — multi-language UI (English/Hindi/Punjabi)
- **jsPDF + jspdf-autotable** — client-side PDF export (reports, receipts)
- **Sonner** — toast notifications
- **Lucide React** — icon library

### Background jobs
A small persistent Node process (`frontend/src/jobs/`, run via `bun run start:jobs`),
separate from the Next.js server, for the two always-on daily loops (due-soon loan
reminders, guardian reading digests) and applying pending migrations/dev-seed data on
boot — a request-driven Next.js server has no in-process runtime that could host a loop
outliving any one request.

### Testing / Dev Tooling
- **Vitest + Testing Library** — unit/component tests
- **Playwright** — end-to-end browser tests against a real running app + DB
- **ESLint + Prettier** — linting and formatting
- **Docker Compose** — local PostgreSQL + Redis
- **Make** — common developer commands

### Deployment / Hosting
No hosting provider is wired up yet — see [§5 Deployment Guide](#5-deployment-guide) for
the platform-agnostic notes on how each piece is meant to be deployed.

---

## 3) Architecture & Diagrams

### 3.1 System Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI["React 19 UI"]
    end

    subgraph "Next.js app (one deployable unit)"
        API["Route Handlers<br/>/api/v1/*"]
    end

    JOBS["Job runner<br/>(separate Node process)"]

    PG[("PostgreSQL<br/>via Prisma")]
    RD[("Redis")]
    LLM{{"LLM Provider<br/>OpenAI / Bedrock / Ollama"}}
    GA["Google OAuth"]
    RP["Razorpay"]

    UI -->|"same-origin + JWT cookie"| API
    API --> PG
    API -->|"rate limits + chat history"| RD
    API -->|"chatbot, book insights,<br/>recommendations, AI ops insights"| LLM
    API -->|"token verification"| GA
    API -->|"membership payments"| RP
    JOBS --> PG
    JOBS -->|"guardian digests"| LLM
```

The browser UI never talks to Postgres, Redis, or the LLM provider directly — every
integration goes through this same Next.js app's own Route Handlers, which are the only
part of the system holding credentials for them. The separate job-runner process shares
the same database and LLM provider for its two background loops. Every LLM-backed
feature is designed to degrade gracefully (see
[§3.4](#34-ai-feature-request-flow)) rather than break the rest of the app if that
provider is unreachable.

### 3.2 Code Structure

```mermaid
flowchart TD
    Root["MAY2026-Team-041/"]
    Root --> Frontend["frontend/  (the whole app)"]
    Root --> Assets["assets/"]
    Root --> Compose["docker-compose.yml"]

    Frontend --> FAppDir["app/  (Next.js routes, layouts,<br/>and api/v1/* Route Handlers)"]
    Frontend --> FPrisma["prisma/  (schema.prisma + migrations/)"]
    Frontend --> FJobs["src/jobs/  (background loops,<br/>run as a separate process)"]
    Frontend --> FServer["src/server/  (30 feature modules)"]
    Frontend --> FSrcRest["src/  (components, features,<br/>providers, i18n — see below)"]
    Frontend --> FTests["tests/e2e/  (Playwright)"]

    FServer --> SM1["catalog &amp; transactions:<br/>books, loans, reservations, seatBooking,<br/>reviews, wishlist, libraryReviews, bookRecords"]
    FServer --> SM2["staff &amp; ops:<br/>manager, admin, itHead, guardian,<br/>auditLog, permissionRequests, supportTickets"]
    FServer --> SM3["billing &amp; growth:<br/>payments, pricingPlans, coupons,<br/>billingRequests, leaderboard, events"]
    FServer --> SM4["AI-backed:<br/>chat, recommendations, translate, llm.ts<br/>(book insights live inside books/)"]
    FServer --> SM5["seed/  (TS ports of the dev-only<br/>demo-data seed scripts)"]

    FSrcRest --> FAppLayouts["app/layouts/  (AppShellLayout + role shells)"]
    FSrcRest --> FComponents["components/  (ui/, layout/, common/)"]
    FSrcRest --> FFeatures["features/  (21 screen folders)"]
    FSrcRest --> FProviders["providers/  (auth, theme, query client, AuthGuard)"]
    FSrcRest --> FI18n["i18n/  (en, hi, pa)"]

    FFeatures --> FF1["books, dashboard, reservations,<br/>seat-booking, reading-progress, ..."]
    FFeatures --> FF2["admin, guardian, it-head,<br/>community, events, leaderboard, ..."]
```

Every `src/server/<module>/` follows the same internal layering, which is what actually
keeps a 30-module codebase navigable — knowing the pattern once means you can find your
way around any of them. A thin Route Handler in `app/api/v1/...` calls into it:

```mermaid
flowchart LR
    RouteHandler["app/api/v1/.../route.ts<br/>HTTP method + auth/role guard"] --> Service["service.ts<br/>business logic, orchestration"]
    Service --> Repository["repository.ts<br/>Prisma queries"]
    Repository --> DB[("PostgreSQL")]
    Service --> Schemas["schemas.ts<br/>Zod request/response shapes"]
```

### 3.3 Database Schema (Core Entities)

The full schema (~30 models — community posts, events, billing, support tickets, audit
log, and more) lives in
[`frontend/prisma/schema.prisma`](frontend/prisma/schema.prisma). The diagram below is
the core library-workflow subset:

```mermaid
erDiagram
    ROLE ||--o{ USER : has
    USER ||--o{ LOAN : borrows
    USER ||--o{ RESERVATION : requests
    USER ||--o{ REVIEW : writes
    USER ||--o{ PAYMENT : makes
    USER ||--o{ WISHLIST : saves
    USER ||--o{ READING_PROGRESS : tracks
    USER ||--o| GUARDIAN_LINK : "guardian in"
    USER ||--o| GUARDIAN_LINK : "member in"
    BOOK ||--o{ LOAN : "borrowed via"
    BOOK ||--o{ RESERVATION : "requested via"
    BOOK ||--o{ REVIEW : receives
    BOOK ||--o{ WISHLIST : "saved in"
    BOOK ||--o{ READING_PROGRESS : "tracked in"
    RESERVATION |o--o| LOAN : "approved into"

    ROLE {
        uuid id PK
        string name "admin, manager, librarian, member, guardian, it-head"
    }
    USER {
        uuid id PK
        string email
        string fullName
        uuid roleId FK
        json readingProfile "AI-generated, cached"
    }
    BOOK {
        uuid id PK
        string title
        string author
        string category
        int totalCopies
        json aiInsights "AI-generated, cached"
        float embedding "AI similarity vector"
    }
    LOAN {
        uuid id PK
        uuid bookId FK
        uuid memberId FK
        datetime dueDate
        datetime returnedAt
        boolean finePaid
    }
    RESERVATION {
        uuid id PK
        uuid memberId FK
        uuid bookId FK
        string status "pending, approved, rejected, cancelled"
        uuid loanId FK
    }
    REVIEW {
        uuid id PK
        uuid bookId FK
        uuid memberId FK
        int rating
        string comment
    }
    PAYMENT {
        uuid id PK
        uuid userId FK
        int amount
        string status
    }
    WISHLIST {
        uuid id PK
        uuid memberId FK
        uuid bookId FK
    }
    READING_PROGRESS {
        uuid id PK
        uuid memberId FK
        uuid bookId FK
        string status "reading, completed"
        int percentComplete
    }
    GUARDIAN_LINK {
        uuid id PK
        uuid guardianId FK
        uuid memberId FK
    }
```

A `Loan` is created either directly (staff issuing a book) or by approving a
`Reservation`, which is why `RESERVATION` optionally points at the `LOAN` it became.
`Book.aiInsights` and `Book.embedding`/`User.readingProfile` are the caches behind the
AI features — see the next diagram for how they're populated.

### 3.4 AI Feature Request Flow

Every AI-backed endpoint (book insights, similarity, reading profiles, manager demand
forecast) follows the same cache-first, degrade-gracefully shape. Book insights shown as
the representative example:

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Next.js Route Handler (/books/{id}/insights)
    participant DB as PostgreSQL
    participant LLM as LLM Provider

    U->>API: GET /books/{id}/insights
    API->>DB: read Book.aiInsights
    alt already cached
        DB-->>API: existing JSON
        API-->>U: 200 (instant — no LLM call)
    else not cached yet
        API->>LLM: one short, structured-JSON prompt
        alt valid JSON returned
            LLM-->>API: summary, difficulty, themes, ...
            API->>DB: save Book.aiInsights
            API-->>U: 200 (freshly generated)
        else provider unreachable / bad output
            API-->>U: 200 with a null body
            Note over U: UI shows an "AI unavailable" state —<br/>the rest of the app is unaffected
        end
    end
```

The cache is invalidated (cleared, not regenerated inline) whenever the book's
title/author/category/description is edited, so the next read regenerates it lazily —
editing a book is never blocked on an LLM call.

---

## 4) Local Setup (Quick Start)

### Prerequisites
- Bun
- Docker (for local PostgreSQL + Redis)
- Optional: [Ollama](https://ollama.com) running locally, if you want AI features
  (chatbot, book insights, recommendations) working without an OpenAI/Bedrock key

### Environment setup
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

The root `.env` owns shared infrastructure values (`DATABASE_URL`, Postgres
credentials/port). Everything else — JWT secret, Google/Razorpay keys, Redis URL, and
the `LLM_MODE`/provider settings — lives in `frontend/.env` (server-side only, read by
`frontend/src/server/*`; never exposed to the browser bundle).

```env
# frontend/.env — AI provider selection (LLM_MODE: openai | bedrock | ollama)
LLM_MODE=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text   # used only for "You may also like" similarity

# Optional integrations
GOOGLE_CLIENT_ID=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

### Install dependencies
```bash
make install
```

### Run the app
One command handles everything — starting Postgres/Redis via Docker, generating the
Prisma client, applying pending migrations, seeding demo data, and starting both the
background jobs process and the Next.js dev server:
```bash
bun run frontend         # from the repo root — the app + its own /api/v1 backend
```
App URL: `http://localhost:3000`

Migrations (`prisma migrate deploy`) and demo-data seeding both run automatically on
every start via the jobs process's `AUTO_MIGRATE`/`AUTO_SEED_DEMO` startup steps
(§3.4/`frontend/src/jobs/index.ts`) — each step is idempotent (upserts, or checks for its
own already-seeded rows and skips), so re-running `bun run frontend` on an already-seeded
database is a fast no-op rather than re-seeding. Ctrl-C stops both the dev server and the
jobs process together.

> **Port already in use?** If a local PostgreSQL instance is already listening on 5432,
> Docker Compose will silently bind to the wrong server. Change `POSTGRES_PORT` and
> `DATABASE_URL` in `.env` to an unused port (e.g. 5433) and re-run. The same applies to
> `REDIS_PORT` and the frontend dev server's port if you're running this checkout
> alongside another copy of the same project on one machine.

### Authoring a new migration
`bun run frontend` only *applies* existing migrations — after changing
`frontend/prisma/schema.prisma`, generate the new migration file with:
```bash
make db-migrate
```

---

## 5) Deployment Guide

No CI-verified deployment target is configured yet. The notes below describe how each
piece is built to be deployed once a host is chosen — swap in whichever
Postgres/container/static hosting provider you use.

### Database
Any managed PostgreSQL works. Point `DATABASE_URL` at it (include `sslmode=require` if
the provider needs it) — pending migrations are applied automatically on job-runner
startup (`AUTO_MIGRATE`, see `frontend/src/jobs/index.ts`).

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

### App (Next.js)
Build then run its own Node server (or deploy to any Next.js-compatible host):
```bash
bun --cwd=frontend run build   # outputs frontend/.next
bun --cwd=frontend run start   # serves the production build, incl. /api/v1/*
```
Required environment variables: `DATABASE_URL`, `JWT_SECRET` (32+ random characters — a
short/default value is rejected in production), `REDIS_URL` pointed at a real Redis
instance. Optional: `GOOGLE_CLIENT_ID`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, and the
`LLM_MODE` + provider credentials for AI features. Leave `NEXT_PUBLIC_API_URL` unset
unless the app's own API routes are deployed at a different origin than the frontend.

### Background jobs
Run `bun --cwd=frontend run start:jobs` as its own long-lived process (container,
systemd unit, etc.) alongside the app, for the two always-on daily loops and
auto-migrate-on-boot. Set `AUTO_SEED_DEMO=false` in production — the demo-data seed is
dev-only.

---

## 6) Demo Credentials (Seeded)

Run the dev-preview seed once (development/test/e2e environments only) — either run the
full job runner (`bun run jobs`, which includes this as its first step) or invoke just
this one seed function directly:
```bash
cd frontend && bun -e "import('./src/server/seed/seedDevAccounts').then(m => m.seedDevAccounts())"
```

| Role      | Email                            | Password        |
| --------- | --------------------------------- | ---------------- |
| Admin     | `admin@devpreview.internal`       | `DevPreview123!` |
| Manager   | `manager@devpreview.internal`     | `DevPreview123!` |
| Librarian | `librarian@devpreview.internal`   | `DevPreview123!` |
| Member    | `member@devpreview.internal`      | `DevPreview123!` |
| Guardian  | `guardian@devpreview.internal`    | `DevPreview123!` |
| IT Head   | `it-head@devpreview.internal`     | `DevPreview123!` |

The password can be overridden with the `DEV_SEED_PASSWORD` environment variable. A
separate, richer catalog + ~5 months of synthetic activity is seeded automatically the
first time the job runner starts in development (`AUTO_SEED_DEMO`, see
`frontend/src/server/seed/seedDemoData.ts`).

---

## 7) Useful URLs

Local app: `http://localhost:3000` (UI + `/api/v1/*` API routes, same origin)

---

## 8) Troubleshooting

- **Database connection failure / Docker binds the wrong Postgres**
  - Verify `DATABASE_URL` format/credentials in `.env`
  - If a local Postgres is already on port 5432, change `POSTGRES_PORT` and
    `DATABASE_URL` to an unused port and restart

- **Prisma client out of date after pulling changes**
  - Someone else's schema change leaves your local Prisma client stale. Run
    `make db-generate`. Enabling the repo's git hooks once
    (`git config core.hooksPath .githooks`) does this automatically after every
    merge/checkout that touches `frontend/prisma/schema.prisma`

- **401/403 errors**
  - Ensure the JWT is sent as `Authorization: Bearer <token>` (or via the httpOnly
    cookie set on login)
  - Confirm the logged-in user's role has permission for that endpoint

- **Google login issues**
  - Keep the same `GOOGLE_CLIENT_ID` value in both server-side (`GOOGLE_CLIENT_ID`) and
    client-side (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) `frontend/.env` entries

- **Razorpay issues**
  - Ensure `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set in `frontend/.env`

- **AI features (chatbot, book insights, recommendations) show "unavailable"**
  - Expected, not a bug: every AI feature degrades gracefully when the configured
    `LLM_MODE` provider is unreachable (see [§3.4](#34-ai-feature-request-flow)). For
    local Ollama, confirm it's running and that `OLLAMA_MODEL`/`OLLAMA_EMBEDDING_MODEL`
    are pulled (`ollama pull <model>`)

---

## 9) Basic Validation Commands

Frontend lint, type-check, and build:
```bash
cd frontend
bun run lint
bun run build
```

Frontend unit tests:
```bash
cd frontend
bun run test
```

End-to-end (Playwright, drives a real browser against the real running app + DB):
```bash
bun run test:e2e:install   # once, to install browser binaries
make test-e2e
```

Or, from the repo root:
```bash
make test
```

---

## 10) License / Sharing Note

No license file is currently included in this repository. This README is intentionally
written as a **standalone project summary** so it can be copied and shared
independently for submissions, reviews, or onboarding.
