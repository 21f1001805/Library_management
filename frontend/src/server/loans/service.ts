import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { HttpError } from '@/server/http';
import { sendEmail } from '@/server/mail';
import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as notificationsService from '@/server/notifications/service';
import * as repository from '@/server/loans/repository';
import type { LoanWithRelations } from '@/server/loans/repository';
import {
  FINE_PER_DAY,
  LOAN_PERIOD_DAYS,
  REMINDER_WINDOW_DAYS,
  REMIND_COOLDOWN_HOURS,
} from '@/server/loans/constants';
import { loanToJson, type LoanCreateInput, type LoanListResponse, type LoanOut } from '@/server/loans/schemas';

// Mirrors backend/src/app/modules/loans/service.py. send_due_soon_reminders is the
// function the phase-9 background job-runner will call on an interval — it exists here
// now (pure business logic) but nothing schedules it yet.

export async function createLoan(
  createdById: string,
  payload: LoanCreateInput,
  opts: { durationDays?: number; client?: Prisma.TransactionClient } = {},
): Promise<LoanOut> {
  const durationDays = opts.durationDays ?? LOAN_PERIOD_DAYS;
  const dueDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  let loan: LoanWithRelations | null;
  try {
    loan = await repository.createIfAvailable({
      bookId: payload.book_id,
      memberId: payload.member_id,
      dueDate,
      createdById,
      client: opts.client,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new HttpError(404, 'Book or member not found');
    }
    throw err;
  }

  if (!loan) {
    const db = opts.client ?? prisma;
    const book = await db.book.findUnique({ where: { id: payload.book_id } });
    if (!book) throw new HttpError(404, 'Book or member not found');
    throw new HttpError(409, 'No copies are currently available');
  }

  return loanToJson(loan, new Date());
}

export async function listActiveLoans(): Promise<LoanOut[]> {
  const now = new Date();
  const rows = await repository.listActive();
  return rows.map((row) => loanToJson(row, now));
}

export async function listAllLoans(opts: {
  page: number;
  pageSize: number;
}): Promise<LoanListResponse> {
  const now = new Date();
  const [rows, total] = await repository.listAll(opts);
  return {
    items: rows.map((row) => loanToJson(row, now)),
    total,
    page: opts.page,
    page_size: opts.pageSize,
  };
}

export async function listMyLoans(
  memberId: string,
  client?: Prisma.TransactionClient,
): Promise<LoanOut[]> {
  const now = new Date();
  const rows = await repository.listForMember(memberId, client);
  return rows.map((row) => loanToJson(row, now));
}

export async function listFines(): Promise<LoanOut[]> {
  // Includes returned-but-still-unpaid loans, not just currently-overdue ones — a
  // member who returns a book late still owes the fine until it's marked paid.
  const now = new Date();
  const rows = await repository.listFined();
  return rows.map((row) => loanToJson(row, now));
}

export async function sumOutstandingFines(): Promise<number> {
  return (await repository.sumOutstandingFineDays()) * FINE_PER_DAY;
}

// Clears a member's late-return fines after they've paid, returning the count settled.
// Oldest fine first, and only while the amount paid still covers it — a short payment
// leaves the rest owed rather than wiping the whole balance.
export async function settleFinesForMember(
  memberId: string,
  amountPaid: number,
  client?: Prisma.TransactionClient,
): Promise<number> {
  const loans = await listMyLoans(memberId, client);
  const unpaid = loans.filter((loan) => loan.fine_amount > 0 && !loan.fine_paid);

  let remaining = amountPaid;
  const toSettle: string[] = [];
  for (const loan of [...unpaid].sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    if (loan.fine_amount > remaining) break;
    remaining -= loan.fine_amount;
    toSettle.push(loan.id);
  }

  if (toSettle.length > 0) await repository.markFinesPaid(toSettle, client);
  return toSettle.length;
}

export async function returnLoan(loanId: string): Promise<LoanOut> {
  const existing = await repository.findById(loanId);
  if (!existing) throw new HttpError(404, 'Loan not found');
  if (existing.returnedAt !== null) throw new HttpError(409, 'This loan was already returned');

  const row = await repository.markReturned(loanId, new Date());
  return loanToJson(row, new Date());
}

export async function markFinePaid(loanId: string, actorId: string): Promise<LoanOut> {
  const existing = await repository.findById(loanId);
  if (!existing) throw new HttpError(404, 'Loan not found');

  const row = await repository.markFinePaid(loanId);
  const out = loanToJson(row, new Date());
  // Staff clearing a fine moves money off the books with no gateway record behind it, so
  // it belongs in the audit log next to the other financial decisions.
  await auditLogService.record({
    actorId,
    action: AuditAction.FINE_MARKED_PAID,
    metadata: { loanId, memberId: existing.memberId, amount: out.fine_amount },
  });
  return out;
}

function reminderMessage(loan: LoanWithRelations): string {
  const now = new Date();
  const daysLate = Math.max(
    0,
    Math.round(
      (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        Date.UTC(
          loan.dueDate.getUTCFullYear(),
          loan.dueDate.getUTCMonth(),
          loan.dueDate.getUTCDate(),
        )) /
        86_400_000,
    ),
  );
  if (daysLate > 0) {
    const fine = daysLate * FINE_PER_DAY;
    return (
      `Reminder: '${loan.book.title}' is ${daysLate} day(s) overdue — ` +
      `a fine of ₹${fine} is due. Please return it as soon as possible.`
    );
  }
  const due = loan.dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Reminder: '${loan.book.title}' is due back by ${due}.`;
}

export async function sendReminder(loanId: string): Promise<void> {
  const existing = await repository.findById(loanId);
  if (!existing) throw new HttpError(404, 'Loan not found');

  const message = reminderMessage(existing);
  await notificationsService.createNotification(existing.memberId, 'fine-reminder', message);
  await sendEmail(existing.member.email, 'Library reminder: book due', message);
  await repository.markReminded(loanId, new Date());
}

// Nudges everyone whose loan is due within the window, at most once a day each. Runs on
// the job-runner's startup as well as its ~24h tick (phase 9); the lastRemindedAt check
// here is what makes repeated runs safe.
export async function sendDueSoonReminders(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const remindCutoff = new Date(now.getTime() - REMIND_COOLDOWN_HOURS * 60 * 60 * 1000);

  const loans = await repository.listActive();
  for (const loan of loans) {
    if (loan.dueDate > windowEnd) continue;
    if (loan.lastRemindedAt !== null && loan.lastRemindedAt > remindCutoff) continue;
    const claimed = await repository.claimReminder(loan.id, { remindCutoff, claimedAt: now });
    if (!claimed) continue;
    // Per-loan, so one unreachable mailbox (or a provider rate limit) doesn't abort the
    // sweep and leave everyone after it un-nudged — but still logged.
    try {
      await sendReminder(loan.id);
    } catch (err) {
      console.error(`send_reminder failed for loan ${loan.id}`, err);
    }
  }
}
