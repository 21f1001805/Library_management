import { z } from 'zod';

import type { SupportTicketWithRelations } from '@/server/supportTickets/repository';
import { TicketCategory } from '@/server/supportTickets/constants';

// Mirrors backend/src/app/modules/support_tickets/schemas.py.
export const supportTicketCreateSchema = z.object({
  category: z.enum(Object.values(TicketCategory) as [string, ...string[]]),
  description: z.string().min(10).max(500),
});
export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;

export const supportTicketResolveSchema = z.object({
  resolution_note: z.string().min(1).max(1000),
});
export type SupportTicketResolveInput = z.infer<typeof supportTicketResolveSchema>;

export interface SupportTicketOut {
  id: string;
  category: string;
  description: string;
  status: string;
  raised_by_id: string;
  raised_by_name: string;
  raised_by_role: string;
  resolution_note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function supportTicketToJson(ticket: SupportTicketWithRelations): SupportTicketOut {
  return {
    id: ticket.id,
    category: ticket.category,
    description: ticket.description,
    status: ticket.status,
    raised_by_id: ticket.raisedById,
    raised_by_name: ticket.raisedBy.fullName,
    raised_by_role: ticket.raisedBy.role.name,
    resolution_note: ticket.resolutionNote,
    resolved_by_name: ticket.resolvedBy?.fullName ?? null,
    resolved_at: ticket.resolvedAt?.toISOString() ?? null,
    closed_at: ticket.closedAt?.toISOString() ?? null,
    created_at: ticket.createdAt.toISOString(),
    updated_at: ticket.updatedAt.toISOString(),
  };
}
