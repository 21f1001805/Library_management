import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import { currentChatUser } from '@/server/chat/context';
import * as booksService from '@/server/books/service';
import type { BookSort } from '@/server/books/schemas';
import * as eventsService from '@/server/events/service';
import * as leaderboardService from '@/server/leaderboard/service';
import * as loansService from '@/server/loans/service';
import * as membersService from '@/server/members/service';
import * as notificationsService from '@/server/notifications/service';
import * as pricingPlansService from '@/server/pricingPlans/service';
import * as reservationsService from '@/server/reservations/service';
import * as seatBookingService from '@/server/seatBooking/service';
import type { SeatBookingCreateInput } from '@/server/seatBooking/schemas';
import * as supportTicketsService from '@/server/supportTickets/service';
import type { SupportTicketCreateInput } from '@/server/supportTickets/schemas';

// Mirrors backend/src/app/modules/chat/orchestrator.py's TOOLS in full — async
// LangChain tools wrapping existing service functions, one per Python @tool function.
// Each tool reads the authenticated user from chat/context.ts's AsyncLocalStorage
// (currentChatUser()) instead of Python's ContextVar, and — since that's the *real*
// AuthenticatedUser rather than Python's ad-hoc `_FakeUser` stand-ins — passes it
// straight to services that expect one (seat booking, notifications, support tickets),
// no faking required.

const STAFF_ROLES = new Set<string>([Role.ADMIN, Role.LIBRARIAN, Role.MANAGER, Role.IT_HEAD]);
const LOAN_MANAGER_ROLES = STAFF_ROLES;

const UUID_RE = /^[0-9a-f-]{36}$/i;

// Surfaces expected, user-actionable failures; hides everything else. Services throw
// HttpError with text already written for users ("No copies are currently available"),
// so that's safe to pass through. Anything else — Prisma errors, provider internals —
// must not reach the model, which relays tool output to the user more or less verbatim.
function toolError(action: string, exc: unknown): string {
  if (exc instanceof HttpError) return `${action}: ${exc.message}`;
  console.error(`chat tool failed: ${action}`, exc);
  return `${action}: something went wrong on our side. Please try again.`;
}

const IST_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

function formatIST(date: Date): string {
  // en-GB gives "08 Sep 2026, 09:30 pm" — uppercase the meridiem to match Python's %p.
  return IST_FORMATTER.format(date).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

function todayUtc(): { dateString: string; hour: number } {
  const now = new Date();
  return { dateString: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// READ TOOLS — all authenticated users
// ═══════════════════════════════════════════════════════════════════════════════

const getUpcomingEvents = tool(
  async () => {
    const result = await eventsService.listEvents({
      page: 1,
      pageSize: 10,
      memberId: currentChatUser().id,
      timeframe: 'upcoming',
    });
    if (result.items.length === 0) return 'No upcoming events found.';
    return JSON.stringify(
      result.items.map((e) => ({
        id: e.id,
        title: e.title,
        date: formatIST(new Date(e.date)),
        location: e.location,
        capacity: e.capacity,
        attendees: e.attendees,
        registered: e.registered,
      })),
    );
  },
  {
    name: 'get_upcoming_events',
    description: 'Fetch upcoming library events. Always call with query="".',
    schema: z.object({ query: z.string().default('') }),
  },
);

const getBooks = tool(
  async ({ query, sort }) => {
    const sortValue: BookSort = (['newest', 'rating', 'recommended'] as const).includes(
      sort as BookSort,
    )
      ? (sort as BookSort)
      : 'newest';

    const seen = new Map<string, Awaited<ReturnType<typeof booksService.listBooks>>['items'][number]>();
    // Try the full query first, then fall back to individual keywords so that
    // multi-word or misspelled queries still surface partial matches.
    const terms = query ? [query] : [];
    if (query && query.includes(' ')) {
      terms.push(...query.split(/\s+/).filter((w) => w.length > 2));
    }

    for (const term of terms) {
      const result = await booksService.listBooks({
        search: term || null,
        category: null,
        sort: sortValue,
        page: 1,
        pageSize: 10,
        memberId: null,
      });
      for (const b of result.items) {
        if (!seen.has(b.id)) seen.set(b.id, b);
      }
      if (seen.size > 0) break; // full-query hit — no need to try individual keywords
    }

    if (seen.size === 0) {
      // Last resort: return all books so the LLM can reason over them.
      const result = await booksService.listBooks({
        search: null,
        category: null,
        sort: sortValue,
        page: 1,
        pageSize: 10,
        memberId: null,
      });
      for (const b of result.items) seen.set(b.id, b);
    }

    const books = [...seen.values()].slice(0, 10);
    return JSON.stringify(
      books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category,
        available: b.available,
        copies: b.total_copies,
        average_rating: b.average_rating,
        review_count: b.review_count,
      })),
    );
  },
  {
    name: 'get_books',
    description:
      "List/search books. query=\"\" for a sample of books. sort='recommended' for personalised picks, 'rating' for top rated, 'newest' for latest. ALWAYS call this for any book recommendation request. The query is matched against title, author, and description — pass the most meaningful single keyword (e.g. 'comic' not 'cnic', 'funny' not 'fummy'). If the user's phrasing is misspelled or informal, correct it to the closest real English word before passing. NOTE: this tool returns up to 10 books as a sample — it does NOT return the full catalog. Always present results as 'here are some books' or 'here are a few books', never 'here are all the books'.",
    schema: z.object({ query: z.string().default(''), sort: z.string().default('newest') }),
  },
);

const getHighestRatedBooks = tool(
  async () => {
    const result = await booksService.listBooks({
      search: null,
      category: null,
      sort: 'rating',
      page: 1,
      pageSize: 10,
      memberId: null,
    });
    if (result.items.length === 0) return 'No books found.';
    const rated = result.items.filter((b) => b.review_count > 0);
    if (rated.length === 0) return 'No books have been reviewed yet. Ratings are not available.';
    return JSON.stringify(
      rated.map((b) => ({
        title: b.title,
        author: b.author,
        average_rating: b.average_rating,
        review_count: b.review_count,
      })),
    );
  },
  {
    name: 'get_highest_rated_books',
    description:
      'Get books sorted by highest average rating. Only returns books that actually have reviews. Call with query="".',
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMyLoans = tool(
  async () => {
    const items = await loansService.listMyLoans(currentChatUser().id);
    if (items.length === 0) return 'empty_loans';
    return JSON.stringify(
      items.map((loan) => ({
        id: loan.id,
        book: loan.book_title,
        due_date: formatDMY(new Date(loan.due_date)),
        status: loan.status,
        days_late: loan.days_late,
        fine_amount: loan.fine_amount,
        fine_paid: loan.fine_paid,
      })),
    );
  },
  {
    name: 'get_my_loans',
    description:
      "Get current user's borrowed books, due dates, overdue status, and fines. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMyReservations = tool(
  async () => {
    const items = await reservationsService.listMyReservations(currentChatUser().id);
    if (items.length === 0) return 'empty_reservations';
    return JSON.stringify(
      items.map((r) => ({
        id: r.id,
        book: r.book_title,
        status: r.status,
        queue_position: r.queue_position,
        eta_days: r.eta_days,
      })),
    );
  },
  {
    name: 'get_my_reservations',
    description: "Get current user's book reservations and queue position. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMySeatBookings = tool(
  async () => {
    const items = await seatBookingService.listMyBookings(currentChatUser());
    if (items.length === 0) return 'empty_seat_bookings';
    return JSON.stringify(
      items.map((b) => ({ booking_id: b.id, seat: b.seat_label, date: b.date, hour: b.hour })),
    );
  },
  {
    name: 'get_my_seat_bookings',
    description: "Get current user's upcoming seat bookings. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getSeatAvailability = tool(
  async () => {
    const { dateString, hour } = todayUtc();
    const summary = await seatBookingService.getAvailabilitySummary();
    const schedule = await seatBookingService.getSchedule(currentChatUser(), dateString, hour);
    const availableSeats = schedule.seats.filter((s) => s.status === 'available').map((s) => s.seat_label);
    return JSON.stringify({
      today: dateString,
      current_hour: hour,
      available_now: summary.available,
      total: summary.total,
      available_seat_labels: availableSeats.slice(0, 8),
    });
  },
  {
    name: 'get_seat_availability',
    description:
      "Get current seat availability with available seat labels and today's date/time. Call before booking a seat.",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMyNotifications = tool(
  async () => {
    const items = await notificationsService.listMyNotifications(currentChatUser());
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return 'No unread notifications for this user.';
    return JSON.stringify(unread.map((n) => ({ type: n.type, message: n.message })));
  },
  {
    name: 'get_my_notifications',
    description: "Get current user's unread notifications. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMySupportTickets = tool(
  async () => {
    const items = await supportTicketsService.listMyTickets(currentChatUser());
    if (items.length === 0) return 'No support tickets raised by this user.';
    return JSON.stringify(
      items.map((t) => ({ id: t.id, category: t.category, status: t.status, description: t.description })),
    );
  },
  {
    name: 'get_my_support_tickets',
    description: "Get current user's support tickets and their status. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getLeaderboard = tool(
  async () => {
    const items = await leaderboardService.getLeaderboard(currentChatUser().id);
    if (items.length === 0) return 'The leaderboard is empty.';
    return JSON.stringify(
      items.slice(0, 10).map((e) => ({
        rank: e.rank,
        name: e.full_name,
        books_completed: e.books_completed,
        is_you: e.is_current_user,
      })),
    );
  },
  {
    name: 'get_leaderboard',
    description: "Get reading leaderboard — top members by books completed. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMyReadingProgress = tool(
  async () => {
    const items = await membersService.listReadingProgress(currentChatUser().id);
    if (items.length === 0) return 'empty_reading_progress';
    return JSON.stringify(
      items.map((p) => ({ book: p.book_title, status: p.status, percent: p.percent_complete })),
    );
  },
  {
    name: 'get_my_reading_progress',
    description: "Get current user's reading progress — books reading or completed. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMyReadingGoal = tool(
  async () => {
    const goal = await membersService.getReadingGoal(currentChatUser().id);
    if (goal === null) return "You haven't set a reading goal yet.";
    return JSON.stringify({
      yearly_goal: goal.yearly_goal,
      monthly_goal: goal.monthly_goal,
      completed_this_year: goal.books_completed_this_year,
      completed_this_month: goal.books_completed_this_month,
    });
  },
  {
    name: 'get_my_reading_goal',
    description:
      "Get current user's reading goal and books completed this year/month. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getMyReadingStreak = tool(
  async () => {
    const streak = await membersService.getReadingStreak(currentChatUser().id);
    return JSON.stringify({
      current_streak_days: streak.current_streak_days,
      longest_streak_days: streak.longest_streak_days,
    });
  },
  {
    name: 'get_my_reading_streak',
    description: "Get current user's login/reading streak in days. Call with query=\"\".",
    schema: z.object({ query: z.string().default('') }),
  },
);

const getPricingPlans = tool(
  async () => {
    const plans = await pricingPlansService.listPlans();
    if (plans.length === 0) return 'No pricing plans found.';
    return JSON.stringify(
      plans.map((p) => ({
        plan: p.plan_id,
        months: p.months,
        price_inr: p.price,
        save_percent: p.save_percent,
        badge: p.badge,
      })),
    );
  },
  {
    name: 'get_pricing_plans',
    description: 'Get library membership pricing plans. Call with query="".',
    schema: z.object({ query: z.string().default('') }),
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION TOOLS — write operations any authenticated user can do on themselves
// ═══════════════════════════════════════════════════════════════════════════════

const reserveBook = tool(
  async ({ book_id }) => {
    try {
      let bookId = book_id;
      // If it doesn't look like a UUID, treat it as a title search.
      if (!UUID_RE.test(bookId)) {
        const result = await booksService.listBooks({
          search: bookId,
          category: null,
          sort: 'newest',
          page: 1,
          pageSize: 1,
          memberId: null,
        });
        if (result.items.length === 0) {
          return `Could not find a book matching '${bookId}'. Please check the title.`;
        }
        bookId = result.items[0].id;
      }

      const reservation = await reservationsService.createReservation(currentChatUser().id, {
        book_id: bookId,
      });
      return (
        `Reserved '${reservation.book_title}'. Status: ${reservation.status}.` +
        (reservation.queue_position ? ` Queue position: ${reservation.queue_position}.` : '')
      );
    } catch (exc) {
      return toolError('Could not reserve book', exc);
    }
  },
  {
    name: 'reserve_book',
    description:
      'Reserve a book. book_id can be the actual ID or a book title — if a title is passed the tool will look it up automatically.',
    schema: z.object({ book_id: z.string() }),
  },
);

const cancelReservation = tool(
  async ({ reservation_id }) => {
    try {
      let reservationId = reservation_id;
      if (!UUID_RE.test(reservationId)) {
        const items = await reservationsService.listMyReservations(currentChatUser().id);
        const match = items.find((r) => r.book_title.toLowerCase().includes(reservationId.toLowerCase()));
        if (!match) return `Could not find a reservation matching '${reservationId}'.`;
        reservationId = match.id;
      }
      await reservationsService.cancelReservation(currentChatUser().id, reservationId);
      return 'Reservation cancelled successfully.';
    } catch (exc) {
      return toolError('Could not cancel reservation', exc);
    }
  },
  {
    name: 'cancel_reservation',
    description:
      'Cancel a pending reservation. reservation_id can be the actual ID or a book title — the tool will look it up.',
    schema: z.object({ reservation_id: z.string() }),
  },
);

function resolveBookingDate(date: string): string {
  const today = todayUtc().dateString;
  if (date.toLowerCase() === 'today') return today;
  if (date.toLowerCase() === 'tomorrow') {
    const t = new Date();
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
  }
  return date;
}

const bookSeat = tool(
  async ({ seat_label, date, hour }) => {
    try {
      const parsedDate = resolveBookingDate(date);
      let seatLabel = seat_label;

      // Auto-pick first available seat if not specified.
      if (!seatLabel || seatLabel.toLowerCase() === 'any') {
        const schedule = await seatBookingService.getSchedule(currentChatUser(), parsedDate, hour);
        const available = schedule.seats.filter((s) => s.status === 'available').map((s) => s.seat_label);
        if (available.length === 0) {
          return `No seats available on ${parsedDate} at ${String(hour).padStart(2, '0')}:00.`;
        }
        seatLabel = available[0];
      }

      const payload: SeatBookingCreateInput = { seat_label: seatLabel, date: parsedDate, hour };
      const result = await seatBookingService.bookSeat(currentChatUser(), payload);
      return `Seat ${result.seat_label} booked for ${result.date} at ${String(result.hour).padStart(2, '0')}:00.`;
    } catch (exc) {
      return toolError('Could not book seat', exc);
    }
  },
  {
    name: 'book_seat',
    description:
      "Book a library seat. If seat_label is unknown, pass 'any' and the tool will pick the first available one. date: 'YYYY-MM-DD' or 'today' or 'tomorrow'. hour: 0-23 integer (e.g. 21 for 9pm).",
    schema: z.object({ seat_label: z.string(), date: z.string(), hour: z.number().int().min(0).max(23) }),
  },
);

const cancelSeatBooking = tool(
  async ({ booking_id }) => {
    try {
      await seatBookingService.cancelBooking(currentChatUser(), booking_id);
      return 'Seat booking cancelled successfully.';
    } catch (exc) {
      return toolError('Could not cancel booking', exc);
    }
  },
  {
    name: 'cancel_seat_booking',
    description: 'Cancel a seat booking. booking_id must come from get_my_seat_bookings tool output.',
    schema: z.object({ booking_id: z.string() }),
  },
);

const registerForEvent = tool(
  async ({ event_id }) => {
    try {
      let eventId = event_id;
      if (!UUID_RE.test(eventId)) {
        const events = await eventsService.listEvents({
          page: 1,
          pageSize: 20,
          memberId: currentChatUser().id,
          timeframe: 'upcoming',
        });
        const match = events.items.find((e) => e.title.toLowerCase().includes(eventId.toLowerCase()));
        if (!match) return `Could not find an event matching '${eventId}'.`;
        eventId = match.id;
      }
      const registeredEvent = await eventsService.register(eventId, currentChatUser().id);
      return `Registered for '${registeredEvent.title}' successfully.`;
    } catch (exc) {
      return toolError('Could not register for event', exc);
    }
  },
  {
    name: 'register_for_event',
    description:
      'Register current user for an event. event_id can be the actual ID or an event name — the tool will look it up automatically.',
    schema: z.object({ event_id: z.string() }),
  },
);

const unregisterFromEvent = tool(
  async ({ event_id }) => {
    try {
      const result = await eventsService.unregister(event_id, currentChatUser().id);
      return `Unregistered from '${result.title}' successfully.`;
    } catch (exc) {
      return toolError('Could not unregister', exc);
    }
  },
  {
    name: 'unregister_from_event',
    description: 'Unregister current user from an event. event_id must come from get_upcoming_events tool output.',
    schema: z.object({ event_id: z.string() }),
  },
);

const raiseSupportTicket = tool(
  async ({ category, description }) => {
    try {
      const payload: SupportTicketCreateInput = {
        category: category as SupportTicketCreateInput['category'],
        description,
      };
      const result = await supportTicketsService.createTicket(currentChatUser(), payload);
      return `Support ticket raised (ID: ${result.id}). Status: ${result.status}.`;
    } catch (exc) {
      return toolError('Could not raise ticket', exc);
    }
  },
  {
    name: 'raise_support_ticket',
    description:
      'Raise a support ticket. category: one of book_reservation/payment/seat_booking/harassment/offline_library/attendance/other. description: min 10 chars.',
    schema: z.object({ category: z.string(), description: z.string() }),
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

function formatDMY(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const getMembers = tool(
  async ({ query }) => {
    if (!STAFF_ROLES.has(currentChatUser().role.name)) {
      return "You don't have permission to view member data.";
    }
    const result = await membersService.listMembers({
      search: query || null,
      page: 1,
      pageSize: 10,
      role: null,
      activeOnly: false,
    });
    if (result.items.length === 0) return 'No members found.';
    return JSON.stringify({
      total_count: result.total,
      members: result.items.map((m) => ({
        name: m.full_name,
        email: m.email,
        role: m.role.name,
        active: m.is_active,
        last_login: m.last_login_at ? formatDMY(new Date(m.last_login_at)) : 'Never',
      })),
    });
  },
  {
    name: 'get_members',
    description:
      'STAFF ONLY. Search members by name/email (query="" for all). Role must be admin/librarian/manager/it_head. NOTE: returns a sample of up to 10 members plus the real total count. Never say the total is 10 — always report the actual total_count field.',
    schema: z.object({ query: z.string().default('') }),
  },
);

const getActiveLoans = tool(
  async () => {
    if (!LOAN_MANAGER_ROLES.has(currentChatUser().role.name)) {
      return "You don't have permission to view loan data.";
    }
    const items = await loansService.listActiveLoans();
    if (items.length === 0) return 'No active loans.';
    const overdue = items.filter((loan) => loan.status === 'overdue');
    return JSON.stringify({
      total_active: items.length,
      overdue_count: overdue.length,
      loans: items.slice(0, 20).map((loan) => ({
        id: loan.id,
        book: loan.book_title,
        member: loan.member_name,
        due_date: formatDMY(new Date(loan.due_date)),
        status: loan.status,
        fine: loan.fine_amount,
      })),
    });
  },
  {
    name: 'get_active_loans',
    description: 'STAFF ONLY. Get all active/overdue loans across all members. Call with query="".',
    schema: z.object({ query: z.string().default('') }),
  },
);

const getOutstandingFines = tool(
  async () => {
    if (!LOAN_MANAGER_ROLES.has(currentChatUser().role.name)) {
      return "You don't have permission to view fine data.";
    }
    const items = await loansService.listFines();
    const unpaid = items.filter((loan) => !loan.fine_paid);
    if (unpaid.length === 0) return 'No outstanding fines.';
    const total = unpaid.reduce((sum, loan) => sum + loan.fine_amount, 0);
    return JSON.stringify({
      total_outstanding: total,
      count: unpaid.length,
      fines: unpaid.slice(0, 20).map((loan) => ({
        loan_id: loan.id,
        book: loan.book_title,
        member: loan.member_name,
        amount: loan.fine_amount,
      })),
    });
  },
  {
    name: 'get_outstanding_fines',
    description: 'STAFF ONLY. Get all unpaid fines across all members. Call with query="".',
    schema: z.object({ query: z.string().default('') }),
  },
);

const getAllSupportTickets = tool(
  async ({ status_filter }) => {
    if (!STAFF_ROLES.has(currentChatUser().role.name)) {
      return "You don't have permission to view all support tickets.";
    }
    const items = await supportTicketsService.listAllTickets(status_filter || null);
    if (items.length === 0) return 'No support tickets found.';
    return JSON.stringify(
      items.slice(0, 20).map((t) => ({
        id: t.id,
        category: t.category,
        status: t.status,
        raised_by: t.raised_by_name,
      })),
    );
  },
  {
    name: 'get_all_support_tickets',
    description: "STAFF ONLY. Get all support tickets. status_filter: 'open'/'resolved'/'closed'/'' for all.",
    schema: z.object({ status_filter: z.string().default('') }),
  },
);

const returnLoan = tool(
  async ({ loan_id }) => {
    if (!LOAN_MANAGER_ROLES.has(currentChatUser().role.name)) {
      return "You don't have permission to return loans.";
    }
    let loanId = loan_id;
    if (!UUID_RE.test(loanId)) {
      const items = await loansService.listActiveLoans();
      const overdue = items.filter((loan) => loan.status === 'overdue');
      const target = overdue[0] ?? items[0];
      if (!target) return 'No active loans found to return.';
      loanId = target.id;
    }
    try {
      const result = await loansService.returnLoan(loanId);
      return `Loan for '${result.book_title}' marked as returned.`;
    } catch (exc) {
      return toolError('Could not return loan', exc);
    }
  },
  {
    name: 'return_loan',
    description: 'STAFF ONLY. Mark a loan as returned. loan_id must come from get_active_loans tool output.',
    schema: z.object({ loan_id: z.string() }),
  },
);

const sendLoanReminder = tool(
  async ({ loan_id }) => {
    if (!LOAN_MANAGER_ROLES.has(currentChatUser().role.name)) {
      return "You don't have permission to send reminders.";
    }
    let loanId = loan_id;
    if (!UUID_RE.test(loanId)) {
      const items = await loansService.listActiveLoans();
      const overdue = items.filter((loan) => loan.status === 'overdue');
      if (overdue.length === 0) return 'No overdue loans found to send a reminder for.';
      loanId = overdue[0].id;
    }
    try {
      await loansService.sendReminder(loanId);
      return 'Reminder sent successfully.';
    } catch (exc) {
      return toolError('Could not send reminder', exc);
    }
  },
  {
    name: 'send_loan_reminder',
    description: 'STAFF ONLY. Send overdue reminder to a member. loan_id must come from get_active_loans tool output.',
    schema: z.object({ loan_id: z.string() }),
  },
);

export const TOOLS = [
  getUpcomingEvents,
  getBooks,
  getHighestRatedBooks,
  getMyLoans,
  getMyReservations,
  getMySeatBookings,
  getSeatAvailability,
  getMyNotifications,
  getMySupportTickets,
  getLeaderboard,
  getMyReadingProgress,
  getMyReadingGoal,
  getMyReadingStreak,
  getPricingPlans,
  reserveBook,
  cancelReservation,
  bookSeat,
  cancelSeatBooking,
  registerForEvent,
  unregisterFromEvent,
  raiseSupportTicket,
  getMembers,
  getActiveLoans,
  getOutstandingFines,
  getAllSupportTickets,
  returnLoan,
  sendLoanReminder,
];
