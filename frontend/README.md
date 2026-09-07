# Frontend — Community Reading Club & Library Management Platform

The React frontend for the Community Reading Club platform: browsing the catalogue,
borrowing/reserving books, booking study seats, joining events, tracking reading
progress, subscribing/paying for a plan, and role-specific dashboards for Members,
Guardians, Librarians, Managers, IT Heads, and Admins.

For the full product context (problem statement, architecture decisions, what's
mocked vs. real), see [`../docs/FINAL_SPEC.md`](../docs/FINAL_SPEC.md).
This file only covers running and developing the frontend itself.

## Stack

- React 19 + TypeScript + Next.js (App Router)
- Bun (package manager, dev/build/test script runner)
- Tailwind CSS v4
- Next.js file-based routing + `proxy.ts` for server-side auth/role gating, with
  `providers/AuthGuard.tsx` (`RequireAuth`/`RequireRole`/`RedirectIfAuthenticated`) as
  client-side defense in depth
- TanStack Query (wired up, not yet used for real fetching — see "Current Status")
- React Hook Form + Zod (forms/validation)
- Framer Motion (animations, centralized variants in `lib/motion.ts`)
- react-i18next (3 languages — see "Internationalization")
- Sonner (toasts)
- Vitest + Testing Library (unit tests), Playwright (e2e, configured at the repo root)

## Current Status

Every screen is built and fully interactive against **mock data** (`src/mocks/*.ts`),
not a real backend yet — that's Milestone 3. Auth is also mocked: the Login page is a
role picker (Member / Librarian / Manager / Admin / IT Head / Guardian) that sets a
fake signed-in state, which is enough to exercise real route guards and role-specific
UI end-to-end. Payment is likewise mocked: the Pricing and Payment pages are real and
routable, but the "Pay with Razorpay" button and manager cash-payment flow just show a
toast — there's no backend to create a Razorpay order or verify a signature yet.

## Prerequisites

- Bun

## Setup

From this `frontend/` directory:

```bash
cp .env.example .env
bun install
```

`.env` only needs `NEXT_PUBLIC_API_URL` (the backend base URL — unused by the app until
Milestone 3 wires up real API calls).

## Development

```bash
bun run dev
```

Opens the app at http://localhost:3000 with hot reload.

## Available Scripts

| Script           | Description                                 |
| ---------------- | ------------------------------------------- |
| `bun run dev`    | Start the Next.js dev server                |
| `bun run build`  | Type-check and production-build to `.next/` |
| `bun run start`  | Serve the production build locally          |
| `bun run lint`   | Run ESLint                                  |
| `bun run format` | Run Prettier (writes changes)               |
| `bun run test`   | Run Vitest unit tests                       |

End-to-end tests (Playwright) live in `tests/e2e/` but are run from the **repo root**
(`bun run test:e2e` there), since the Playwright config also manages starting the dev
server.

## Project Structure

```text
app/                          # Next.js routes — one folder per URL segment, thin
│                                page.tsx/layout.tsx wrappers around src/features/*
├── (public)/                  # Landing, Pricing, Contact, Login/Register/Forgot/Reset
├── (app)/                     # Dashboard, Books, Reservations, Seat Booking, ... (any
│                                 signed-in role) + manager/ (manager/librarian only)
├── admin/ | it-head/ | guardian/   # One dedicated route group per staff role
├── layout.tsx                 # Root layout — mounts <AppProviders>
└── not-found.tsx

proxy.ts                      # Server-side session/role gating (Next 16's renamed
│                                middleware.ts) — redirects before a protected page ships

src/
├── app/layouts/                # AppShellLayout (shared authenticated shell) + one
│                                 thin per-role wrapper (AdminLayout, UserLayout, ...)
├── providers/                # QueryClientProvider, ThemeProvider, LanguageProvider,
│                                AuthProvider (mocked), AuthGuard (RequireAuth/RequireRole)
├── components/
│   ├── ui/                    # Shared primitives: Button, Card, Input, Modal, Table, ...
│   ├── layout/                 # Header (Logo/DesktopNavigation/MobileNavigation/
│   │   └── header/               AuthActions), Sidebar, TopBar, Footer, UserMenu, ...
│   └── common/                 # Cross-feature building blocks: BookCard, EventCard,
│                                  StatisticCard, PageLoader, IconBadge, Section, ...
├── features/                 # One folder per screen — each owns its pages/ and components/
│   ├── landing/ | pricing/     # Marketing site + subscription plans
│   ├── dashboard/               # Role-aware: Member/Librarian/Manager dashboards
│   ├── admin/ | it-head/ | guardian/   # Dedicated role dashboards
│   ├── payment/                 # Razorpay/pay-at-library checkout (mocked)
│   ├── books/ | reservations/ | seat-booking/ | events/ | reviews/
│   ├── leaderboard/ | notifications/ | profile/ | reading-progress/
├── mocks/                    # Mock data per feature, shaped like the future real API
├── screens/                  # Login, Register, ForgotPassword, ResetPassword, NotFound
├── i18n/                     # i18next config + locales/*.json (en, hi, pa)
├── constants/                # ROUTES, navigation items
├── lib/                      # cn(), motion.ts (shared Framer Motion variants),
│                                authSchema.ts (Zod), comingSoonToast, format.ts, ...
├── styles.css                # Theme tokens (CSS variables) + Tailwind
└── test/                     # Vitest setup
```

**Rule of thumb:** every page is built from `components/ui`/`components/common` —
never bespoke one-off markup. If you're adding UI that doesn't fit an existing
primitive, add it to the shared kit rather than hand-rolling it in a feature folder.

## Routing & Roles

Routes are Next.js App Router segments under `app/`, gated two ways:

- **`proxy.ts`** (repo root) — server-side, runs before a protected page ships. Reads
  the non-httpOnly `is_logged_in`/`session_role` cookies the backend sets on login (see
  `backend/src/app/core/cookies.py`) and redirects unauthenticated/wrong-role requests
  immediately, so there's no flash of protected content.
- **`src/providers/AuthGuard.tsx`** — client-side defense in depth (`RequireAuth`,
  `RequireRole`, `RedirectIfAuthenticated`), reacting to auth-state changes that happen
  without a fresh navigation (e.g. the dev-preview role buttons on Login).

Layout groups, each a thin wrapper in `src/app/layouts/` around the shared
`AppShellLayout`:

- **`(public)`** — Landing, Pricing, Contact, Login, Register, Forgot/Reset Password
  (`RedirectIfAuthenticated` bounces already-signed-in users to their dashboard)
- **`(app)`** — Dashboard (role-aware — renders a different component per role),
  Books, Reservations, Seat Booking, Payment, Events, Community, Profile, Reading
  Progress, Leaderboard, Reviews, Settings (`RequireAuth`: any authenticated role), plus
  a nested `manager/` group (`RequireRole(['manager', 'librarian'])`)
- **`admin/` / `it-head/` / `guardian/`** — each gated by `RequireRole` to its specific
  role

## Internationalization

`src/i18n/config.ts` loads 3 locale bundles (`en`, `hi`, `pa`) via `react-i18next`;
`LanguageProvider` persists the chosen language and syncs `<html lang/dir>` (no
current locale is RTL, but the mechanism supports one). All locale files are kept in
exact key parity — when adding a new translatable string, add it to all 3 files, not
just `en.json`.

## Environment Variables

| Variable              | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Backend base URL — not yet consumed; reserved for Milestone 3 |

## Notes for Milestone 3

Swapping mocks for real data should mostly mean replacing `mocks/<feature>.ts`
imports with `useQuery(...)` calls inside the same components — `QueryClientProvider`
is already mounted in `providers/AppProviders.tsx`, and page components already treat
their data as a variable, not a live call. Two other pieces to replace without
touching their consumers:

- `AuthProvider` (`providers/AuthProvider.tsx`) — swap the mocked `login()`/`logout()`
  for real JWT-backed calls; the route guards that consume it don't need to change.
- `PaymentPage` (`features/payment/pages/PaymentPage.tsx`) — swap the mocked
  "Pay with Razorpay" handler for a real Razorpay Checkout.js call once a backend
  endpoint exists to create an order (`order_id`) and verify the payment signature.
