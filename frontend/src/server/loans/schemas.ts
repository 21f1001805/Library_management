import { z } from 'zod';

import type { LoanWithRelations } from '@/server/loans/repository';
import { FINE_PER_DAY } from '@/server/loans/constants';

// Mirrors backend/src/app/modules/loans/schemas.py.
export const loanCreateSchema = z.object({
  book_id: z.string(),
  member_id: z.string(),
});
export type LoanCreateInput = z.infer<typeof loanCreateSchema>;

export interface LoanOut {
  id: string;
  book_id: string;
  book_title: string;
  member_id: string;
  member_name: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  days_late: number;
  fine_amount: number;
  fine_paid: boolean;
  status: 'active' | 'overdue' | 'returned';
}

function daysBetween(a: Date, b: Date): number {
  const aUtc = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((aUtc - bUtc) / 86_400_000);
}

export function loanToJson(loan: LoanWithRelations, now: Date): LoanOut {
  const end = loan.returnedAt ?? now;
  const daysLate = Math.max(0, daysBetween(end, loan.dueDate));

  let status: LoanOut['status'];
  if (loan.returnedAt !== null) status = 'returned';
  else if (daysLate > 0) status = 'overdue';
  else status = 'active';

  return {
    id: loan.id,
    book_id: loan.bookId,
    book_title: loan.book.title,
    member_id: loan.memberId,
    member_name: loan.member.fullName,
    borrowed_at: loan.borrowedAt.toISOString(),
    due_date: loan.dueDate.toISOString(),
    returned_at: loan.returnedAt?.toISOString() ?? null,
    days_late: daysLate,
    fine_amount: daysLate * FINE_PER_DAY,
    fine_paid: loan.finePaid,
    status,
  };
}

export interface LoanListResponse {
  items: LoanOut[];
  total: number;
  page: number;
  page_size: number;
}
