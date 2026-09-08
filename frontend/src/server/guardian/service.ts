import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Prisma } from '@prisma/client';

import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import { buildChatLlm, logLlmFailure } from '@/server/llm';
import * as loansService from '@/server/loans/service';
import * as membersRepository from '@/server/members/repository';
import { readingProgressToJson } from '@/server/members/schemas';
import * as notificationsService from '@/server/notifications/service';
import * as paymentsRepository from '@/server/payments/repository';
import { paymentToJson, type PaymentOut } from '@/server/payments/schemas';
import { calculateMembershipExpiry } from '@/server/payments/service';
import * as pricingPlansRepository from '@/server/pricingPlans/repository';
import * as seatBookingService from '@/server/seatBooking/service';
import type { SeatBookingCreateInput, SeatNotifyCreateInput } from '@/server/seatBooking/schemas';
import * as repository from '@/server/guardian/repository';
import type { Child } from '@/server/guardian/repository';
import {
  type GuardianChildOut,
  type GuardianContactOut,
  type GuardianLinkCreateInput,
} from '@/server/guardian/schemas';

// Mirrors backend/src/app/modules/guardian/service.py in full.
const RENEWAL_PLAN_CODE = '1m';

async function validatePair(guardianId: string, memberId: string): Promise<void> {
  const guardian = await membersRepository.findById(guardianId);
  const child = await membersRepository.findById(memberId);
  if (!guardian || !child) {
    throw new HttpError(404, 'Guardian or member not found');
  }
  if (guardian.role.name !== Role.GUARDIAN || !guardian.isActive || guardian.deletedAt !== null) {
    throw new HttpError(422, 'Guardian must be an active guardian account');
  }
  if (child.role.name !== Role.MEMBER || !child.isActive || child.deletedAt !== null) {
    throw new HttpError(422, 'Child must be an active member account');
  }
}

export async function linkChild(payload: GuardianLinkCreateInput): Promise<void> {
  await validatePair(payload.guardian_id, payload.member_id);
  try {
    await repository.createLink({ guardianId: payload.guardian_id, memberId: payload.member_id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') throw new HttpError(409, 'This member already has a guardian');
      if (err.code === 'P2003') throw new HttpError(404, 'Guardian or member not found');
    }
    throw err;
  }
}

export async function linkMyGuardian(
  memberId: string,
  guardianEmail: string,
): Promise<GuardianContactOut> {
  const guardian = await membersRepository.findByEmail(guardianEmail.trim());
  if (!guardian || guardian.role.name !== Role.GUARDIAN || !guardian.isActive || guardian.deletedAt !== null) {
    throw new HttpError(400, 'No active guardian account found with this email');
  }

  await repository.upsertLink({ guardianId: guardian.id, memberId });
  return {
    id: guardian.id,
    full_name: guardian.fullName,
    email: guardian.email,
    linked_at: new Date().toISOString(),
  };
}

export async function unlinkMyGuardian(memberId: string): Promise<void> {
  await repository.deleteLinkForMember(memberId);
}

// Link, or repoint an existing link at a different guardian. Separate from linkChild
// rather than making that one replace: linking a second guardian over an existing one
// is still a 409 there (staff shouldn't overwrite a link by accident), while this is
// the deliberate "change guardian" action.
export async function setGuardian(payload: GuardianLinkCreateInput): Promise<void> {
  await validatePair(payload.guardian_id, payload.member_id);
  try {
    await repository.upsertLink({ guardianId: payload.guardian_id, memberId: payload.member_id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new HttpError(404, 'Guardian or member not found');
    }
    throw err;
  }
}

export async function unlinkChild(memberId: string): Promise<void> {
  const removed = await repository.deleteLinkForMember(memberId);
  if (!removed) throw new HttpError(404, 'This member does not have a guardian');
}

export async function getMyGuardian(memberId: string): Promise<GuardianContactOut | null> {
  const link = await repository.findLinkForMember(memberId);
  if (!link || !link.guardian) return null;
  return {
    id: link.guardian.id,
    full_name: link.guardian.fullName,
    email: link.guardian.email,
    linked_at: link.createdAt.toISOString(),
  };
}

async function findChildOr403(guardianId: string, childId: string): Promise<Child> {
  const children = await repository.listChildren(guardianId);
  const child = children.find((c) => c.id === childId);
  if (!child) throw new HttpError(403, "This member isn't linked to you");
  return child;
}

async function childOut(child: Child): Promise<GuardianChildOut> {
  const childProgress = await membersRepository.listReadingProgress(child.id);
  const progress = childProgress.map(readingProgressToJson);

  const loans = await loansService.listMyLoans(child.id);
  const unpaid = loans.filter((loan) => loan.fine_amount > 0 && !loan.fine_paid);
  const outstandingFine = unpaid.reduce((sum, loan) => sum + loan.fine_amount, 0);
  const worstLoan = unpaid.reduce<(typeof unpaid)[number] | null>(
    (worst, loan) => (!worst || loan.days_late > worst.days_late ? loan : worst),
    null,
  );

  const membershipPayments = await paymentsRepository.listMembershipPayments(child.id);
  const subscriptionExpiresOn = calculateMembershipExpiry(membershipPayments);

  return {
    id: child.id,
    full_name: child.fullName,
    email: child.email,
    currently_reading: progress.filter((p) => p.status === 'reading'),
    completed: progress.filter((p) => p.status === 'completed'),
    outstanding_fine: outstandingFine,
    fine_book_title: worstLoan?.book_title ?? null,
    fine_due_date: worstLoan?.due_date ?? null,
    subscription_expires_on: subscriptionExpiresOn?.toISOString() ?? null,
  };
}

export async function listMyChildren(guardianId: string): Promise<GuardianChildOut[]> {
  const children = await repository.listChildren(guardianId);
  const out: GuardianChildOut[] = [];
  for (const child of children) out.push(await childOut(child));
  return out;
}

export async function listChildPayments(guardianId: string, childId: string): Promise<PaymentOut[]> {
  const child = await findChildOr403(guardianId, childId);
  // This view isn't paginated itself (a guardian has few children, each with a short
  // history) — page_size just mirrors the old hard cap so behavior is unchanged.
  const [payments] = await paymentsRepository.listPaymentsForUser({
    userId: child.id,
    page: 1,
    pageSize: 200,
  });
  return payments.map(paymentToJson);
}

export async function payChildFines(guardianId: string, childId: string): Promise<void> {
  const child = await findChildOr403(guardianId, childId);

  const loans = await loansService.listMyLoans(child.id);
  const unpaid = loans.filter((loan) => loan.fine_amount > 0 && !loan.fine_paid);
  if (unpaid.length === 0) throw new HttpError(400, 'No outstanding fines for this child');

  const total = unpaid.reduce((sum, loan) => sum + loan.fine_amount, 0);
  // This endpoint is a request to pay at the library, not proof that money moved. Only
  // a verified gateway callback or staff cash-reconciliation flow may settle a
  // loan/create a successful Payment row.
  await notificationsService.notifyRoles(
    [Role.MANAGER],
    'payment-pending',
    `A guardian wants to pay ₹${total} in cash to clear fines for ${child.fullName}.`,
  );
}

export async function renewChildSubscription(guardianId: string, childId: string): Promise<void> {
  const child = await findChildOr403(guardianId, childId);

  const plan = await pricingPlansRepository.findByPlanCode(RENEWAL_PLAN_CODE);
  if (!plan) throw new HttpError(503, 'No renewal plan configured');

  // Preserve the 204 request contract, but do not grant membership before payment.
  await notificationsService.notifyRoles(
    [Role.MANAGER],
    'payment-pending',
    `A guardian wants to pay ₹${plan.price} in cash for a ${plan.months}-month ` +
      `membership renewal for ${child.fullName}.`,
  );
}

export async function bookSeatForChild(
  guardianId: string,
  childId: string,
  payload: SeatBookingCreateInput,
) {
  const child = await findChildOr403(guardianId, childId);
  const guardian = await membersRepository.findById(guardianId);
  const bookingOut = await seatBookingService.bookSeat(child, payload);
  if (guardian) {
    await notificationsService.createNotification(
      child.id,
      'seat-booked-by-guardian',
      `Seat ${payload.seat_label} was booked for you by your guardian (${guardian.fullName}) ` +
        `for ${payload.date} at ${String(payload.hour).padStart(2, '0')}:00.`,
    );
  }
  return bookingOut;
}

export async function requestSeatNotifyForChild(
  guardianId: string,
  childId: string,
  payload: SeatNotifyCreateInput,
): Promise<void> {
  const child = await findChildOr403(guardianId, childId);
  await seatBookingService.requestNotify(child, payload);
}

function monthBounds(reference: Date): [Date, Date] {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const next = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
  return [start, next];
}

// Deterministic sentence used when the LLM is unavailable — unlike the review digest
// (supplementary), this monthly touchpoint should still land either way.
function fallbackDigestMessage(
  childName: string,
  completedThisMonth: number,
  completedLastMonth: number,
  topCategory: string | null,
): string {
  if (completedThisMonth === 0) {
    return `${childName} hasn't finished a book yet this month — a gentle nudge might help!`;
  }
  const plural = completedThisMonth !== 1 ? 's' : '';
  const genreClause = topCategory ? `, mostly ${topCategory}` : '';
  if (completedThisMonth >= completedLastMonth) {
    return (
      `${childName} finished ${completedThisMonth} book${plural} this month${genreClause}, ` +
      `up from ${completedLastMonth} last month.`
    );
  }
  return `${childName} finished ${completedThisMonth} book${plural} this month${genreClause}.`;
}

const DIGEST_SYSTEM_PROMPT = `You write a one-sentence monthly reading update for a guardian
about a linked child's reading activity.

Given the child's name, how many books they completed this month, how many they
completed last month, and their most common genre this month (if any), write exactly
one warm, plain sentence — like a quick note from a librarian, not a report. Rules:
- State only the numbers and genre given. Never invent a book title, plot detail, or
  any fact not provided.
- If they completed 0 books this month, keep the tone encouraging, not a complaint.
- Output only the sentence itself — no greeting, no sign-off.`;

async function digestMessage(
  childName: string,
  completedThisMonth: number,
  completedLastMonth: number,
  topCategory: string | null,
): Promise<string> {
  const human =
    `Child: ${childName}\n` +
    `Books completed this month: ${completedThisMonth}\n` +
    `Books completed last month: ${completedLastMonth}\n` +
    `Most common genre this month: ${topCategory ?? 'none'}`;

  try {
    const llm = await buildChatLlm();
    const result = await llm.invoke([new SystemMessage(DIGEST_SYSTEM_PROMPT), new HumanMessage(human)]);
    const message = String(result.content).trim();
    if (message) return message;
  } catch (exc) {
    logLlmFailure('guardian_digest', exc, { child: childName });
  }

  return fallbackDigestMessage(childName, completedThisMonth, completedLastMonth, topCategory);
}

// Notifies each guardian with a one-line reading update for their linked child, at most
// once per calendar month per link — see GuardianLink.lastDigestSentAt, the same
// DB-backed cooldown pattern as Loan.lastRemindedAt.
export async function sendMonthlyReadingDigests(): Promise<void> {
  const now = new Date();
  const [thisMonthStart, nextMonthStart] = monthBounds(now);
  const [lastMonthStart] = monthBounds(new Date(thisMonthStart.getTime() - 24 * 60 * 60 * 1000));

  const links = await repository.listAllLinks();
  for (const link of links) {
    const sent = link.lastDigestSentAt;
    if (sent && sent.getUTCFullYear() === now.getUTCFullYear() && sent.getUTCMonth() === now.getUTCMonth()) {
      continue;
    }

    try {
      const [completedThisMonth, topCategory] = await repository.countCompletedInRange(
        link.memberId,
        thisMonthStart,
        nextMonthStart,
      );
      const [completedLastMonth] = await repository.countCompletedInRange(
        link.memberId,
        lastMonthStart,
        thisMonthStart,
      );
      const message = await digestMessage(
        link.member.fullName,
        completedThisMonth,
        completedLastMonth,
        topCategory,
      );
      await notificationsService.createNotification(link.guardianId, 'reading-digest', message);
      await repository.markDigestSent(link.id);
    } catch (err) {
      console.error(`guardian monthly digest failed for link ${link.id}`, err);
    }
  }
}
