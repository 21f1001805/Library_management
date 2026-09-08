import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/support_tickets/constants.py.
export const TicketCategory = {
  BOOK_RESERVATION: 'book_reservation',
  PAYMENT: 'payment',
  SEAT_BOOKING: 'seat_booking',
  HARASSMENT: 'harassment',
  OFFLINE_LIBRARY: 'offline_library',
  ATTENDANCE: 'attendance',
  OTHER: 'other',
} as const;
export type TicketCategoryValue = (typeof TicketCategory)[keyof typeof TicketCategory];

// Guardians only ever raise a ticket about their own experience (attendance, their
// child's seat booking, a payment) — not member-only categories like book reservations.
export const CATEGORIES_BY_ROLE: Record<string, Set<string>> = {
  [Role.MEMBER]: new Set([
    TicketCategory.BOOK_RESERVATION,
    TicketCategory.PAYMENT,
    TicketCategory.SEAT_BOOKING,
    TicketCategory.HARASSMENT,
    TicketCategory.OFFLINE_LIBRARY,
    TicketCategory.OTHER,
  ]),
  [Role.GUARDIAN]: new Set([
    TicketCategory.ATTENDANCE,
    TicketCategory.SEAT_BOOKING,
    TicketCategory.PAYMENT,
    TicketCategory.OTHER,
  ]),
};

export const STAFF_ROLES = [Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD];
export const RAISER_ROLES = [Role.MEMBER, Role.GUARDIAN];
