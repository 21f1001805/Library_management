# 📚 Community Reading Club & Library Management Platform
## Final Specification (Merged)

> Base document: `Project_Specification_V2.md` (frozen scope, architecture, phased roadmap).
> Supplemented with dev-reference sections from `PROJECT_SPECIFICATION.md` (v1) that V2 didn't cover: tech stack, folder/architecture conventions, reusable components, coding guidelines, git workflow.
>
> Where the two documents conflicted, V2 wins (see Conflict Resolutions at the end).

---

## 1. Project Overview

### Problem Statement

Community libraries still rely heavily on paper registers, spreadsheets, WhatsApp groups, and manual workflows to manage books, members, borrowing, reservations, events, and managers.

The goal of this project is to build a modern web application that digitizes library operations while promoting community engagement through reading clubs, AI-powered recommendations, seat booking, gamification, and analytics.

### Project Goals

- Digitize library management
- Manage members and memberships
- Automate borrowing and returns
- Support book reservations
- Manage study seat bookings
- Organize reading clubs and events
- Encourage community participation
- Support AI-powered book recommendations
- Track reading progress
- Generate analytics and reports

### User Roles

**Admin** — User Management, Roles & Permissions, Analytics, Reports, Platform Configuration, Audit Logs

**Librarian** — Book Management, Inventory, Issue & Return Books, Reservations, Fine Management, QR Code Borrowing

**Member** — Borrow Books, Reserve Books, Seat Booking, Book Reviews, Reading Progress, Reading Challenges, Community Discussions

**Manager** — Event Management, Attendance, Reading Sessions, Community Activities

---

## 2. Architectural Review: Overlaps, Redundancies & Consolidations

Several features in the original list are *user-facing labels* for what should be a *single backend subsystem*. Building them as separate features leads to duplicated logic, inconsistent behavior, and rework later.

| Overlapping Features | Consolidate Into | Why |
|---|---|---|
| AI Librarian + Mood-Based Recommendation | **One Recommendation Service** with two entry points: a conversational query interface and a tag/mood filter interface. Both query the same underlying book-tagging/embedding layer. | Two separate recommendation engines double the maintenance burden and drift out of sync. |
| QR Codes (Book Management) + QR Code Borrowing + Seat "Scan QR codes" | **One Scanning/Check-in Subsystem** — a generic `scan_token` type used for both books and seats, resolved by a single endpoint. | Staff use the same physical scanner/camera for both. |
| Achievements + Community Score + Leaderboard + Reading Badges | **One Gamification Engine** — a rules-driven point/event system. Badges and leaderboard rank are *derived views* over the same event stream. | One feature with three visualizations, not four features. |
| Reservation Notification + Email Notifications + Telegram Notifications + admin "Configure Notifications" | **One Notification Service** with pluggable channels (email first, Telegram later) and a template/trigger registry. | Otherwise every future feature re-implements delivery, retries, and preferences. |
| Borrow History + Payment History + Reservation History | **One Activity Ledger per member**, filterable by type. | Avoids three near-identical history tables/UIs. |
| Book Heatmap + Seat Occupancy Dashboard + Admin Analytics | **One Analytics/Aggregation Pipeline**, feeding multiple dashboard widgets. | Same aggregation infrastructure, different chart components on top. |

**Architectural recommendation:** design five backend services/modules from day one — `RecommendationService`, `ScanningService`, `GamificationEngine`, `NotificationService`, `AnalyticsService` — even though only a subset ships in the MVP.

---

## 3. Missing Features a Real-World Library System Needs

**Operational / Policy**
- Configurable fine rules: grace period, per-day rate, max cap, per-category overrides (data, not hardcoded)
- Book condition & loss handling: damaged/lost, replacement billing, write-off workflow
- Reservation expiry: auto-cancel + auto-promote next in queue
- Membership plans/tiers: expiry dates, renewal reminders, borrowing limits tied to plan

**Trust & Safety**
- Content moderation for discussion rooms/reviews (report/flag, admin review queue, auto-hide threshold)
- Admin audit trail: who issued/waived a fine, approved a donation, edited a book record

**Discovery**
- Full-text/faceted search (author, category, availability, tags)
- External ISBN lookup (Google Books/Open Library) to auto-fill title/author/cover

**Operations**
- Data export: CSV/PDF for reports
- Backup/restore policy — decide before go-live given PostgreSQL holds financial (payments/fines) data

**Growth path**
- Multi-branch/location support: model `Branch` as an entity now to avoid a painful migration later

---

## 4. Security, Scalability & Usability Recommendations

### Security
- Granular RBAC as capabilities (`can_issue_book`, `can_waive_fine`, `can_approve_donation`) assigned to roles, not three fixed roles
- Short-lived JWT access tokens + refresh tokens, refresh token rotation on use
- Rate limiting on the AI Librarian endpoint specifically (LLM cost-abuse surface)
- File upload validation for Cloudinary uploads (type, size, dimension limits)
- Payment webhook signature verification — never trust client-reported payment success
- Server-side authorization on every mutating endpoint, independent of frontend role checks

### Scalability
- Separate OLTP paths from analytics/dashboard reads — scheduled jobs writing pre-aggregated snapshots, not live aggregation on page load
- PostgreSQL indexing strategy decided up front: text index for book search, compound indexes for `(status, due_date)` on loans, `(date, seat_id)` on bookings
- Caching layer (Redis) for high-read, low-latency data: live seat availability, popular books, leaderboard
- Background job architecture for time-based work: fine accrual, reservation expiry, renewal reminders
- Pagination/cursor-based queries on every list endpoint from the start

### Usability
- Mobile-first design — seat booking and QR check-in are primarily phone use cases
- Explicit empty/loading/error states for every list view
- Progressive disclosure of gamification — don't surface leaderboards/badges to a brand-new user
- A single global search, not separate book/discussion search UIs

---

## 5. Feature Categorization

### 🟢 Core MVP
*The platform is unusable as a replacement for paper/spreadsheets/WhatsApp without these.*

- Authentication: Register, Login, JWT, Role-Based Access, Forgot Password
- Book Management: CRUD, Categories, Authors, ISBN, Covers, Multiple Copies
- Borrowing: Issue, Return, Renew, Borrow History, Automatic Fine (configurable rules)
- Reservations: basic single-queue Reserve Book (notification deferred)
- Seat Booking: basic day-level Seat Reservation (no live dashboard yet)
- Payments: Membership Fees, Fine Payments, Payment History
- Admin Dashboard: Revenue, Active Members, Overdue Books (basic numbers)
- Member Dashboard: Borrowed Books, Seat Booking
- Full-text book search
- Staff workflows: Register Members, Allocate Seats

### 🟡 Important (Phase 2)
*Not required to replace paper processes, but expected soon after launch.*

- Unified QR Code Borrowing / Scanning (books + seats)
- Reservation Queue (multi-member) + Reservation Notification (Notification Service, email channel only)
- Book Reviews
- Book Donations (with admin approval workflow)
- Seat Plans (multiple zones/rooms) + Live Seat Availability + Seat Occupancy Dashboard
- Popular Books / Monthly Reports (Analytics Service)
- Granular RBAC refinement
- Content moderation basics (report/flag)
- Data export (CSV/PDF)

### 🟠 Advanced (Phase 3)
*Differentiators that build community engagement — needs an active user base to be meaningful.*

- Book Discussion Rooms (requires moderation first)
- Mood-Based Book Recommendation (tag-based, no LLM required)
- Gamification Engine: Achievements, Community Score, Leaderboard, Badges
- Telegram Notifications (second channel on Notification Service)
- Quote of the Day

### 🔴 Future Scope (Phase 4+)
*High cost/complexity relative to MVP value, or dependent on data/usage the platform doesn't have yet.*

- AI Librarian (conversational, LLM-backed)
- Book Heatmap (needs months of real usage data)
- Multi-branch support
- Predictive analytics (demand forecasting)
- Native mobile app

---

## 6. Features Deliberately Postponed

- **AI Librarian** — requires catalogue-grounded retrieval, LLM cost management, abuse/rate-limiting, conversation UI. Ship **Mood-Based Recommendation first** (tag-matching, same schema) — 70% of perceived value at a fraction of the cost, and validates demand before investing further.
- **Book Heatmap** — only insightful with real historical traffic. Defer until Phase 4, after 2–3 months of production data.
- **Telegram Notifications** — build the Notification Service with email only first; Telegram becomes a config addition, not a rebuild.
- **Full Gamification Suite at launch** — needs a critical mass of active members; a leaderboard with 3 names isn't rewarding.

---

## 7. Recommended Development Order (Phased Roadmap)

Chosen to minimize rework: each phase's data model is a stable foundation for the next, and shared services (Notification, Analytics, Scanning, Gamification, Recommendation) are built **once**, in the phase where first needed.

**Phase 0 — Foundation**
Auth, RBAC/permissions model, base schemas for Users, Books, Categories.

**Phase 1 — Core Library Operations** *(replaces paper registers — first go-live candidate)*
Book CRUD, Issue/Return/Renew, Borrow History, configurable Fines, basic Reservations, Membership + Fine Payments, basic Admin/Member dashboards, full-text search.

**Phase 2 — Operational Efficiency**
Notification Service (email) + Scanning/QR Service — first used for reservation alerts and book/seat check-in. Seat Plans, Live Seat Availability, Occupancy Dashboard. Analytics Service (aggregation pipeline) — first used for Popular Books/Monthly Reports.

**Phase 3 — Community & Engagement**
Donations, Reviews, Discussion Rooms (moderation first), then Gamification Engine on top of the Phase 1 Activity Ledger. Reuses Notification Service for badge/leaderboard alerts.

**Phase 4 — Smart & AI Features**
Mood-Based Recommendation (tag matching) → AI Librarian (once catalogue tagging is in place) → Book Heatmap (once usage data exists) → Telegram channel on Notification Service.

---

## 8. Finalized Feature List (Frozen Scope)

| # | Feature | Category | Phase |
|---|---|---|---|
| 1 | Register / Login / JWT / Forgot Password | Core MVP | 0 |
| 2 | Role-Based Access Control | Core MVP | 0 |
| 3 | Book CRUD, Categories, Authors, ISBN, Covers, Multiple Copies | Core MVP | 1 |
| 4 | Full-text Book Search | Core MVP | 1 |
| 5 | Issue / Return / Renew Book | Core MVP | 1 |
| 6 | Borrow History | Core MVP | 1 |
| 7 | Automatic Fine (configurable rules) | Core MVP | 1 |
| 8 | Basic Reservation (single queue, no notification) | Core MVP | 1 |
| 9 | Basic Seat Booking (day-level) | Core MVP | 1 |
| 10 | Membership Fees & Fine Payments + Payment History | Core MVP | 1 |
| 11 | Basic Admin Dashboard (Revenue, Active Members, Overdue) | Core MVP | 1 |
| 12 | Basic Member Dashboard (Borrowed Books, Seat Booking) | Core MVP | 1 |
| 13 | Notification Service (email) | Important | 2 |
| 14 | Reservation Queue + Notifications | Important | 2 |
| 15 | Unified QR Scanning (books + seats) | Important | 2 |
| 16 | Seat Plans, Live Availability, Occupancy Dashboard | Important | 2 |
| 17 | Analytics Service: Popular Books, Monthly Reports | Important | 2 |
| 18 | Data Export (CSV/PDF) | Important | 2 |
| 19 | Content Moderation (report/flag) | Important | 2 |
| 20 | Book Donations (with approval workflow) | Important | 2 |
| 21 | Book Reviews | Important | 2 |
| 22 | Book Discussion Rooms | Advanced | 3 |
| 23 | Gamification Engine (Achievements, Score, Leaderboard, Badges) | Advanced | 3 |
| 24 | Quote of the Day | Advanced | 3 |
| 25 | Mood-Based Recommendation (tag-based) | Advanced | 3 |
| 26 | AI Librarian (LLM-backed) | Future Scope | 4 |
| 27 | Book Heatmap | Future Scope | 4 |
| 28 | Telegram Notifications | Future Scope | 4 |
| 29 | Multi-Branch Support | Future Scope | 4 |
| 30 | Predictive Analytics | Future Scope | 4 |
| 31 | Native Mobile App | Future Scope | 4 |

**Additions folded into the frozen scope above:**
- Configurable fine rules → item 7
- Reservation auto-expiry & queue promotion → item 14
- Membership plan/tier expiry & renewal → item 10
- Book condition/loss handling → Phase 2, alongside item 16
- Admin audit trail → Phase 2, cross-cutting
- External ISBN lookup → Phase 1, alongside item 3
- Backup/restore policy → operational decision, decide before Phase 1 go-live

---

## 9. Technology Stack

### Frontend
React 19, TypeScript, Vite, Tailwind CSS v4, React Router DOM, TanStack Query, React Hook Form, Zod, Axios, Framer Motion, Lucide React, Sonner

### Backend
FastAPI, Python 3.12, Prisma Client Python, JWT Authentication, Pydantic, Uvicorn

### Database
PostgreSQL, Prisma ORM

### Storage
Cloudinary

### Deployment
Frontend → Vercel · Backend → Railway · Database → PostgreSQL

---

## 10. Project Architecture

**Pattern:** Clean Architecture, Feature-Based Architecture, Component-Based UI, REST API

Frontend
```text
React
    ↓
Reusable Components
    ↓
Feature Modules
    ↓
API Layer
```

Backend
```text
FastAPI Routers
        ↓
Application Services
        ↓
Repositories
        ↓
Prisma ORM
        ↓
PostgreSQL
```

### API Style
- REST API, versioned (`/api/v1`), JWT-protected routes, OpenAPI/Swagger docs

### Backend Modules
Authentication, Users, Library, Borrowing, Reservation, Membership, Seat Booking, Community, Donation, Notification, Analytics, AI

### Frontend Pages
**Public** — Landing, Login, Register, Forgot Password
**User** — Dashboard, Books, Book Details, Borrow, Reservations, Seat Booking, Community, Events, Profile, Notifications, Settings
**Admin** — Dashboard, Books, Members, Reports, Analytics, Donations, Events, User Management

---

## 11. Development Principles

Always follow: SOLID, DRY, KISS, Reusable Components, Strict TypeScript, Responsive Design, Accessibility, Semantic HTML, Mobile First, Feature-Based Folder Structure.

Never duplicate UI components. Always reuse existing components.

### Reusable Components

**Layout** — Navbar, Sidebar, Footer, Header, PageHeader

**UI** — Button, Input, Select, Checkbox, Switch, Badge, Avatar, Card, Modal, Drawer, Dialog, Loader, EmptyState, Pagination, Table, SearchBar

**Feature Components** — BookCard, SeatCard, EventCard, FeatureCard, ReviewCard, NotificationCard, AchievementBadge, StatisticCard

---

## 12. Coding Guidelines

When generating code:
- Do NOT generate duplicate components
- Prefer reusable abstractions
- Follow the existing architecture
- Keep files small and focused
- Use feature-based organization
- Write readable code
- Add comments only where necessary
- Use meaningful names
- Use an abstraction layer for AI providers so they can be swapped later

---

## 13. Git Workflow

Feature Branches — e.g. `feature/auth`, `feature/books`, `feature/landing`, `feature/dashboard`, `feature/seat-booking`

Commit Style — `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `test:`, `chore:`

---

## 14. Architecture Update (Prisma ORM)

Implementation stack finalized as: React (frontend), FastAPI (backend), PostgreSQL (database), Prisma ORM / Prisma Client Python.

All future design artifacts (ER Diagram, Prisma Schema, Class Diagrams, REST APIs) should treat the Prisma schema as the single source of truth. Database design follows relational modeling and normalization principles, not document-oriented modeling.

**Schema status:** not yet written. ER diagram, Prisma schema, and API contracts are Step 1, to happen *after* this document's scope is signed off (see Conflict Resolutions).

---

## 15. Important Notes for AI Assistants

Before generating code:
1. Reuse existing components whenever possible.
2. Do not redesign the architecture without sign-off.
3. Follow the Prisma schema once it exists as the single source of truth — do not invent schema ahead of it.
4. Follow the existing folder structure.
5. Keep components modular and reusable.
6. Prefer composition over duplication.
7. Maintain consistent naming conventions.
8. Generate code incrementally, following the Phase 0–4 order in §7, not all at once.
9. Ask for clarification if a requested feature conflicts with this specification.

**Sign-off note:** The main structural decision affecting every later step is §2 — five shared backend services (Notification, Scanning, Analytics, Recommendation, Gamification) designed as reusable modules from Phase 0, even though most of their features don't ship until Phase 2–4. Confirm this before schema design, since it affects how Prisma models for Users, Books, Loans, and Seats are shaped from the first migration.

---

## 16. Extra Features Built Beyond Frozen Scope

The frontend has since built the following beyond the §8 frozen list — not part of the original 31 items, kept here so the spec reflects actual scope. See `FRONTEND_VS_SPEC.md` at repo root for the full build-status audit.

- Pricing page (plans, FAQ, CTA)
- Contact Us page
- Reading Progress page (goals, streaks, reading lists)
- Two extra roles not in §1's role model: **IT-Head** and **Guardian**, each with their own dashboard/features
- Wishlist on Books
- Guardian-linking in Settings
- Manager staff-assist tooling (walk-in assistance, new registrations, add guardian)
- Full i18n system (English/Hindi/Punjabi)
- Light/dark/system theming
- Admin Audit Log widget
- Budget/Expense tracking, Cash Flow breakdown, Pending Requests widgets on the admin dashboard (beyond item 11's basic Revenue/Active Members/Overdue scope)

---

## Conflict Resolutions (v1 vs v2)

| Point | v1 said | v2 said | Resolved as |
|---|---|---|---|
| Schema | Already finalized, don't touch | Not written yet — that's Step 1 | **v2** — schema is pending, written against §7's phase order |
| Reservations | Full queue + notifications in scope now | Notifications deferred to Phase 2 | **v2** — basic single-queue only in MVP |
| AI Librarian | Milestone 5 feature | Phase 4 Future Scope, too ambitious for now | **v2** |
| Seat Booking | Live availability day one | Live dashboard is Phase 2; MVP is day-level only | **v2** |
| Milestone plan | Milestone 1–6, feature-agnostic ordering | Phase 0–4, ordered to avoid rework | **v2** — v1's milestone numbers are dropped; use Phase 0–4 for scheduling |
