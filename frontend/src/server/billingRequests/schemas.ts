import { z } from 'zod';

import type { BillingRequestWithRelations } from '@/server/billingRequests/repository';

// Mirrors backend/src/app/modules/billing_requests/schemas.py.
export const billingRequestCreateSchema = z.object({
  member_id: z.string(),
  type: z.enum(['refund', 'fee_waiver']),
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});
export type BillingRequestCreateInput = z.infer<typeof billingRequestCreateSchema>;

export const waiveFineRequestSchema = z.object({
  member_id: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});
export type WaiveFineRequestInput = z.infer<typeof waiveFineRequestSchema>;

export interface BillingRequestOut {
  id: string;
  type: 'refund' | 'fee_waiver';
  amount: number;
  reason: string;
  status: string;
  member_id: string;
  member_name: string;
  created_by_name: string;
  created_at: string;
  decided_at: string | null;
}

export function billingRequestToJson(row: BillingRequestWithRelations): BillingRequestOut {
  return {
    id: row.id,
    type: row.type as 'refund' | 'fee_waiver',
    amount: row.amount,
    reason: row.reason,
    status: row.status,
    member_id: row.memberId,
    member_name: row.member.fullName,
    created_by_name: row.createdBy.fullName,
    created_at: row.createdAt.toISOString(),
    decided_at: row.decidedAt?.toISOString() ?? null,
  };
}
