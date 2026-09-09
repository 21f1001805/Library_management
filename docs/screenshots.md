# UI Screenshots

A quick visual tour of the app, captured from a running local instance (seeded demo
data, dev-preview accounts). See the [README](../README.md) for setup instructions.

## Landing Page

![Landing page](screenshots/01-landing.png)

The public marketing page — no login required. Book covers, hero copy, and nav links
are served straight from `(public)/page.tsx`; "Get Started" and "Log in" are the only
gates into the rest of the app.

## Login

Role-based dev-preview sign-in for local testing, alongside normal email/password and
Google login.

![Login page](screenshots/02-login.png)

Normal sign-in is email/password (bcrypt-hashed) or Google OAuth token verification.
The "Continue as \<role\>" buttons are a dev-only shortcut that log straight into a
seeded preview account per role, without needing its password.

## Admin Dashboard

Revenue, expenses, membership growth, and recent activity at a glance.

![Admin dashboard](screenshots/03-admin-dashboard.png)

Every number here — revenue, expenses, member count — is computed live from the same
`Payment`/`Expense`/`User` tables the rest of the app writes to; there's no separate
analytics pipeline.

## Books Catalog

Search, filter, and reserve from the shared catalog.

![Books catalog](screenshots/04-books-catalog.png)

Search/filter/sort run as one paginated query against the `Book` table; "Reserve"
creates a `Reservation` row if the title is available, or joins the wait queue if every
copy is already on loan.

## Pricing

![Pricing page](screenshots/05-pricing.png)

Plans (1/3/6/12 months) are seeded rows in the `PricingPlan` table, not hardcoded UI —
an admin can edit prices and discounts without a deploy. Checkout hands off to Razorpay.

## Community

Reading-club discussions and reviews.

![Community page](screenshots/06-community.png)

A shared feed of posts/comments tied to books, with likes, saves, and staff moderation
(report/ban) — post and comment counts shown are live aggregates, not cached copy.

## Leaderboard

![Leaderboard page](screenshots/07-leaderboard.png)

Points accrue automatically from other actions across the app — finishing a book
(+100), writing a review (+25), attending an event (+30), returning on time (+15), a
7-day streak (+50), or a late return (−10) — there's no separate place to "earn points."

## Member Dashboard

The everyday view for a regular member — active loans, reading progress, and quick
actions.

![Member dashboard](screenshots/08-member-dashboard.png)

Pulls together this one member's active loans, upcoming due dates, outstanding fines,
seat bookings, and reading streak into a single query, so nothing here requires
navigating to another page just to check status.

## Manager Dashboard

Front-desk operations — checking members in/out, and today's activity at a glance.

![Manager dashboard](screenshots/09-manager-dashboard.png)

Search-and-check-in writes a `LibraryVisit` row with an entry timestamp; "Check Out"
closes it with an exit timestamp — this is the data source behind the Guardian
dashboard's "currently in library" status for a linked child.

## Guardian Dashboard

A guardian's view of every linked child's activity, dues, and reading progress.

![Guardian dashboard](screenshots/10-guardian-dashboard.png)

A `GuardianLink` row ties a guardian account to a member account server-side; the
guardian can view activity, pay fines, or reserve a seat for the child without ever
seeing the child's own login credentials.

## IT Head Reports

Financial activity, expense approvals, and generated operational reports.

![IT head reports](screenshots/11-it-head-reports.png)

Same underlying financial data as the Admin dashboard, reshaped into exportable
reports (access control, procurement, expense breakdown) — a separate view for a
separate audience, not a separate system.

## Seat Booking

Reserve a study seat for a specific date and time slot.

![Seat booking](screenshots/12-seat-booking.png)

Seats are booked per date+time-slot combination with a database-level uniqueness
constraint on (member, seat, slot) — two people genuinely can't double-book the same
seat, it's not just a UI check.

## Reservations

Track your book borrow requests.

![Reservations](screenshots/13-reservations.png)

When every copy of a title is checked out, requesting to borrow creates a queued
`Reservation` instead of a `Loan`; staff approve it into an actual loan once a copy is
returned, which is why it shows "awaiting manager approval" above.

## Reading Progress

Yearly reading goals, streaks, and book status.

![Reading progress](screenshots/14-reading-progress.png)

Marking a book "completed" here is what actually awards the +100 leaderboard points
and updates the reading streak — the Leaderboard page is just a read-only view of
totals this page (and reviews/events) produces.

## Events

Library-run events and community programs.

![Events](screenshots/15-events.png)

Each event tracks its own capacity and live RSVP count (`EventRegistration` rows);
registering both books your seat and adds points to your leaderboard total.

## Book Detail & AI Insights

AI-generated summary, difficulty rating, and themes for a book.

![Book detail with AI insights](screenshots/16-book-detail-ai-insights.png)

Generated once per book by the configured LLM (OpenAI, AWS Bedrock, or local Ollama)
and cached on the `Book` row — instant on every later visit, and only regenerated if
the book's title/author/category/description is edited.

## AI Chatbot (Shelfie)

A library assistant that answers using live account and catalog data.

![AI chatbot](screenshots/17-ai-chatbot.png)

Shelfie is a LangGraph ReAct agent with ~27 callable tools (search books, check seat
availability, look up loans/fines, register for events, ...) — it calls a tool to
fetch real data for nearly every question rather than answering from the model's own
memory, so its answers stay grounded in what's actually in the database.

## Admin Payments

Every payment on record, across all members.

![Admin payments](screenshots/18-admin-payments.png)

A ledger view over every Razorpay-processed transaction (memberships, renewals, fines)
across all members, with CSV/PDF export for accounting.
