import { HttpError } from '@/server/http';
import type { AuthenticatedUser } from '@/server/auth/guards';
import * as notificationsService from '@/server/notifications/service';
import * as repository from '@/server/supportTickets/repository';
import type { SupportTicketWithRelations } from '@/server/supportTickets/repository';
import { CATEGORIES_BY_ROLE, STAFF_ROLES } from '@/server/supportTickets/constants';
import {
  supportTicketToJson,
  type SupportTicketCreateInput,
  type SupportTicketOut,
  type SupportTicketResolveInput,
} from '@/server/supportTickets/schemas';

// Mirrors backend/src/app/modules/support_tickets/service.py.
const CATEGORY_LABELS: Record<string, string> = {
  book_reservation: 'book reservation',
  payment: 'payment',
  seat_booking: 'seat booking',
  harassment: 'harassment/safety',
  offline_library: 'offline library',
  attendance: 'attendance',
  other: 'general',
};

async function notifyStaff(notificationType: string, message: string): Promise<void> {
  await notificationsService.notifyRoles(STAFF_ROLES, notificationType, message);
}

export async function createTicket(
  user: AuthenticatedUser,
  payload: SupportTicketCreateInput,
): Promise<SupportTicketOut> {
  const allowed = CATEGORIES_BY_ROLE[user.role.name] ?? new Set();
  if (!allowed.has(payload.category)) {
    throw new HttpError(422, "This category isn't available for your role");
  }

  const ticket = await repository.create({
    raisedById: user.id,
    category: payload.category,
    description: payload.description,
  });

  const label = CATEGORY_LABELS[payload.category];
  await notifyStaff('support-ticket', `${user.fullName} raised a ${label} support ticket.`);

  return supportTicketToJson(ticket);
}

export async function listMyTickets(user: AuthenticatedUser): Promise<SupportTicketOut[]> {
  const tickets = await repository.listForRaiser(user.id);
  return tickets.map(supportTicketToJson);
}

export async function listAllTickets(statusFilter: string | null): Promise<SupportTicketOut[]> {
  const tickets = await repository.listAll(statusFilter);
  return tickets.map(supportTicketToJson);
}

export async function resolveTicket(
  ticketId: string,
  staffUser: AuthenticatedUser,
  payload: SupportTicketResolveInput,
): Promise<SupportTicketOut> {
  const existing = await repository.findById(ticketId);
  if (!existing) throw new HttpError(404, 'Ticket not found');
  if (existing.status !== 'open') {
    throw new HttpError(409, 'Only an open ticket can be resolved');
  }

  const ticket = await repository.resolveIfOpen(ticketId, {
    resolvedById: staffUser.id,
    resolutionNote: payload.resolution_note,
  });
  if (!ticket) throw new HttpError(409, 'Only an open ticket can be resolved');

  await notificationsService.createNotification(
    existing.raisedById,
    'support-ticket-resolved',
    "Your support ticket has been resolved — please confirm it's fixed or reopen it.",
  );
  return supportTicketToJson(ticket);
}

export async function confirmTicket(
  ticketId: string,
  user: AuthenticatedUser,
): Promise<SupportTicketOut> {
  await getOwnedResolvedTicket(ticketId, user);
  const ticket = await repository.closeIfResolved(ticketId);
  if (!ticket) throw new HttpError(409, 'This ticket was already updated');
  return supportTicketToJson(ticket);
}

export async function reopenTicket(
  ticketId: string,
  user: AuthenticatedUser,
): Promise<SupportTicketOut> {
  await getOwnedResolvedTicket(ticketId, user);
  const ticket = await repository.reopenIfResolved(ticketId);
  if (!ticket) throw new HttpError(409, 'This ticket was already updated');
  await notifyStaff(
    'support-ticket-reopened',
    `${user.fullName} reopened a support ticket — the fix didn't work.`,
  );
  return supportTicketToJson(ticket);
}

async function getOwnedResolvedTicket(
  ticketId: string,
  user: AuthenticatedUser,
): Promise<SupportTicketWithRelations> {
  const existing = await repository.findById(ticketId);
  if (!existing) throw new HttpError(404, 'Ticket not found');
  if (existing.raisedById !== user.id) throw new HttpError(403, "This isn't your ticket");
  if (existing.status !== 'resolved') {
    throw new HttpError(409, "This ticket isn't awaiting confirmation");
  }
  return existing;
}
