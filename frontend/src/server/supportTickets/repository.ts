import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/support_tickets/repository.py.
const INCLUDE = {
  raisedBy: { include: { role: true } },
  resolvedBy: { include: { role: true } },
} satisfies Prisma.SupportTicketInclude;
export type SupportTicketWithRelations = Prisma.SupportTicketGetPayload<{ include: typeof INCLUDE }>;

// list_all() defaults to every ticket ever raised, resolved or not — a permanent
// history, unlike billing/permission requests' self-limiting "pending only" queues.
const LIST_LIMIT = 200;

export async function create(opts: {
  raisedById: string;
  category: string;
  description: string;
}): Promise<SupportTicketWithRelations> {
  return prisma.supportTicket.create({
    data: { raisedById: opts.raisedById, category: opts.category, description: opts.description },
    include: INCLUDE,
  });
}

export async function findById(ticketId: string): Promise<SupportTicketWithRelations | null> {
  return prisma.supportTicket.findUnique({ where: { id: ticketId }, include: INCLUDE });
}

export async function listForRaiser(raisedById: string): Promise<SupportTicketWithRelations[]> {
  return prisma.supportTicket.findMany({
    where: { raisedById },
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
  });
}

export async function countByStatus(status: string): Promise<number> {
  return prisma.supportTicket.count({ where: { status } });
}

export async function listAll(status: string | null): Promise<SupportTicketWithRelations[]> {
  return prisma.supportTicket.findMany({
    where: status !== null ? { status } : {},
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
  });
}

export async function resolveIfOpen(
  ticketId: string,
  opts: { resolvedById: string; resolutionNote: string },
): Promise<SupportTicketWithRelations | null> {
  const updated = await prisma.supportTicket.updateMany({
    where: { id: ticketId, status: 'open' },
    data: {
      status: 'resolved',
      resolutionNote: opts.resolutionNote,
      resolvedById: opts.resolvedById,
      resolvedAt: new Date(),
    },
  });
  return updated.count === 1 ? findById(ticketId) : null;
}

export async function reopenIfResolved(ticketId: string): Promise<SupportTicketWithRelations | null> {
  const updated = await prisma.supportTicket.updateMany({
    where: { id: ticketId, status: 'resolved' },
    data: { status: 'open' },
  });
  return updated.count === 1 ? findById(ticketId) : null;
}

export async function closeIfResolved(ticketId: string): Promise<SupportTicketWithRelations | null> {
  const updated = await prisma.supportTicket.updateMany({
    where: { id: ticketId, status: 'resolved' },
    data: { status: 'closed', closedAt: new Date() },
  });
  return updated.count === 1 ? findById(ticketId) : null;
}
