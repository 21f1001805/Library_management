import Razorpay from 'razorpay';
// Razorpay's payment-signature verifier is a CJS subpath export (not re-exported from
// the package root, which only exports the Razorpay class itself).
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';

import { Prisma, type Payment } from '@prisma/client';

import { prisma } from '@/server/db';
import { env } from '@/server/env';
import { HttpError } from '@/server/http';
import * as couponsService from '@/server/coupons/service';
import * as loansService from '@/server/loans/service';
import * as notificationsService from '@/server/notifications/service';
import * as pricingPlansRepository from '@/server/pricingPlans/repository';
import * as repository from '@/server/payments/repository';
import {
  paymentToJson,
  type MembershipOut,
  type PaymentCreateInput,
  type PaymentListResponse,
  type PaymentOut,
  type RazorpayOrderOut,
  type RazorpayVerifyRequestInput,
} from '@/server/payments/schemas';
import { Role } from '@/server/constants';

// Mirrors backend/src/app/modules/payments/service.py's calculate_membership_expiry —
// a pure function, ported as-is.
function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the month after `month1to12` (0-based) is the last day of `month1to12`.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function calculateMembershipExpiry(
  payments: { createdAt: Date; planMonths: number | null }[],
): Date | null {
  if (payments.length === 0) return null;

  let expiresAt = payments[0].createdAt;
  for (const payment of payments) {
    const base = payment.createdAt > expiresAt ? payment.createdAt : expiresAt;
    const monthIndex = base.getUTCMonth() + (payment.planMonths ?? 0);
    const year = base.getUTCFullYear() + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const day = Math.min(base.getUTCDate(), daysInMonth(year, month));
    expiresAt = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        base.getUTCHours(),
        base.getUTCMinutes(),
        base.getUTCSeconds(),
        base.getUTCMilliseconds(),
      ),
    );
  }
  return expiresAt;
}

function getClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new HttpError(503, 'Razorpay is not configured on this server');
  }
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

export async function resolvePricingPlan(months: number) {
  const plan = await pricingPlansRepository.findByMonths(months);
  if (!plan) throw new HttpError(400, 'Unknown membership plan');
  return plan;
}

interface OrderCreatingUser {
  id: string;
  fullName: string;
}

export async function createRazorpayOrder(
  user: OrderCreatingUser,
  payload: PaymentCreateInput,
): Promise<RazorpayOrderOut> {
  const client = getClient();

  let amount = payload.amount;
  let label = payload.label;
  let planMonths = payload.plan_months ?? null;
  if (env.APP_ENV !== 'test') {
    if (planMonths !== null) {
      const plan = await resolvePricingPlan(planMonths);
      amount = plan.price;
      planMonths = plan.months;
      label = `${plan.months} month membership`;
    } else {
      const loans = await loansService.listMyLoans(user.id);
      amount = loans
        .filter((loan) => loan.fine_amount > 0 && !loan.fine_paid)
        .reduce((sum, loan) => sum + loan.fine_amount, 0);
      label = 'Outstanding library fines';
      if (amount <= 0) throw new HttpError(409, 'No outstanding fines to pay');
    }
  }

  // A coupon changes the gateway charge, not the debt that a verified fine payment
  // settles. Keep the pre-discount amount in the signed Razorpay order notes so
  // verification never relies on the browser or loses part of the fine.
  const fineSettlementAmount = planMonths === null ? amount : null;

  // Applying a coupon previews the discounted charge but does not consume a use.
  // Redemption is finalized only in the verified-payment transaction below.
  if (payload.coupon_code) {
    const coupon = await couponsService.validateCoupon(payload.coupon_code);
    amount = Math.round((amount * (100 - coupon.discount_percent)) / 100);
  }

  const order = await client.orders.create({
    amount: amount * 100,
    currency: 'INR',
    notes: {
      member_id: user.id,
      label,
      plan_months: String(planMonths ?? ''),
      coupon_code: payload.coupon_code ?? '',
      fine_settlement_amount: String(fineSettlementAmount ?? ''),
    },
  });

  return {
    order_id: String(order.id),
    amount,
    currency: 'INR',
    key_id: env.RAZORPAY_KEY_ID,
    label,
  };
}

export async function verifyAndRecordRazorpayPayment(
  user: OrderCreatingUser,
  payload: RazorpayVerifyRequestInput,
): Promise<PaymentOut> {
  getClient(); // Throws 503 if Razorpay isn't configured, same guard as order creation.

  const verified = validatePaymentVerification(
    { order_id: payload.razorpay_order_id, payment_id: payload.razorpay_payment_id },
    payload.razorpay_signature,
    env.RAZORPAY_KEY_SECRET,
  );
  if (!verified) {
    throw new HttpError(400, 'Payment verification failed');
  }

  // A signature stays valid for the same order/payment/signature triple, so a network
  // retry or a double-submit re-verifies successfully every time. Short-circuit here so
  // a retry returns the payment already on record instead of billing and notifying the
  // member a second time. Ownership is re-checked the same as the fresh-order path
  // below — a razorpay_payment_id is gateway-assigned and globally unique in practice,
  // but nothing stops a caller from guessing/replaying one that belongs to someone
  // else, and this must not hand back another member's payment.
  const existing = await repository.findByRazorpayPaymentId(payload.razorpay_payment_id);
  if (existing) {
    if (existing.userId !== user.id) {
      throw new HttpError(403, 'This order does not belong to you');
    }
    return paymentToJson(existing);
  }

  // The order's amount/label/member_id come back from Razorpay's own record of what was
  // created server-side — never re-trusted from the client at this step.
  const client = getClient();
  const order = await client.orders.fetch(payload.razorpay_order_id);
  const notes = (order.notes ?? {}) as Record<string, string>;
  if (notes.member_id !== user.id) {
    throw new HttpError(403, 'This order does not belong to you');
  }

  const amount = Number(order.amount) / 100;
  const label = notes.label || 'Payment';
  const planMonths = notes.plan_months ? Number(notes.plan_months) : null;
  const couponCode = notes.coupon_code || null;
  const fineSettlementAmount = notes.fine_settlement_amount
    ? Number(notes.fine_settlement_amount)
    : amount;

  // Recording the payment, settling fines, and notifying are all DB writes derived from
  // the same verified signature — one transaction so a crash partway through can't
  // leave a payment recorded with its fines still marked unpaid.
  let payment: Payment;
  try {
    payment = await prisma.$transaction(async (tx) => {
      const created = await repository.createPayment({
        userId: user.id,
        amount,
        label,
        planMonths,
        razorpayPaymentId: payload.razorpay_payment_id,
        razorpayOrderId: payload.razorpay_order_id,
        client: tx,
      });
      if (couponCode) {
        // Insert the gateway payment first. Its unique ID makes concurrent
        // verification retries lose here and roll back before consuming a second
        // coupon use.
        await couponsService.consumeCoupon(couponCode, tx);
      }
      // Same rule as the direct create-payment endpoint — a verified payment with no
      // plan behind it is a fine payment, so settle what it covers.
      if (planMonths === null) {
        await loansService.settleFinesForMember(user.id, fineSettlementAmount, tx);
      }
      await notificationsService.createNotification(
        user.id,
        'payment-received',
        `Payment of ₹${amount} received for ${label}.`,
        tx,
      );
      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost a race against a concurrent retry of the same verify call — the other
      // request already recorded this payment between our pre-check above and this
      // insert. Return what it recorded rather than surfacing a 500 for something that
      // already succeeded.
      const recorded = await repository.findByRazorpayPaymentId(payload.razorpay_payment_id);
      if (!recorded) throw err;
      return paymentToJson(recorded);
    }
    throw err;
  }

  return paymentToJson(payment);
}

// Mirrors router.py's create_payment handler — test-only direct payment recording,
// gated by APP_ENV at the route layer (see app/api/v1/payments/route.ts).
export async function createPayment(
  user: OrderCreatingUser,
  payload: PaymentCreateInput,
): Promise<PaymentOut> {
  let amount = payload.amount;
  if (payload.coupon_code) {
    amount = await couponsService.redeemCoupon(payload.coupon_code, payload.amount);
  }

  const payment = await repository.createPayment({
    userId: user.id,
    amount,
    label: payload.label,
    planMonths: payload.plan_months,
  });
  // No plan attached means this isn't a membership purchase — the "Pay Fine" button is
  // the only non-plan payment the UI creates, so put the money against the member's
  // outstanding fines. Without this the loan stays finePaid=false and the fine keeps
  // showing as owed everywhere after it's been paid.
  if (payload.plan_months === null || payload.plan_months === undefined) {
    await loansService.settleFinesForMember(user.id, amount);
  }
  await notificationsService.createNotification(
    user.id,
    'payment-received',
    `Payment of ₹${amount} received for ${payload.label}.`,
  );
  return paymentToJson(payment);
}

// Mirrors router.py's pay_at_library handler. Cash requests are notifications rather
// than payments, but the displayed amount still must be server-authoritative:
// otherwise a member can forge a manager-facing request by editing the payment
// URL/body.
export async function payAtLibrary(user: OrderCreatingUser, payload: PaymentCreateInput): Promise<void> {
  let amount: number;
  let label: string;
  if (payload.plan_months !== null && payload.plan_months !== undefined) {
    const plan = await resolvePricingPlan(payload.plan_months);
    amount = plan.price;
    label = `${plan.months} month membership`;
  } else {
    const loans = await loansService.listMyLoans(user.id);
    amount = loans
      .filter((loan) => loan.fine_amount > 0 && !loan.fine_paid)
      .reduce((sum, loan) => sum + loan.fine_amount, 0);
    label = 'Outstanding library fines';
    if (amount <= 0) throw new HttpError(409, 'No outstanding fines to pay');
  }

  const message = `${user.fullName} wants to pay ₹${amount} in cash for ${label}.`;
  await notificationsService.notifyRoles([Role.MANAGER], 'payment-pending', message);
}

export async function listMyPayments(
  userId: string,
  opts: { page: number; pageSize: number },
): Promise<PaymentListResponse> {
  const [payments, total] = await repository.listPaymentsForUser({
    userId,
    page: opts.page,
    pageSize: opts.pageSize,
  });
  return {
    items: payments.map(paymentToJson),
    total,
    page: opts.page,
    page_size: opts.pageSize,
  };
}

export async function getMyMembership(userId: string): Promise<MembershipOut | null> {
  const payments = await repository.listMembershipPayments(userId);
  if (payments.length === 0) return null;
  const expiresAt = calculateMembershipExpiry(payments);
  if (!expiresAt) throw new Error('Membership payments unexpectedly produced no expiry');
  const payment = payments[payments.length - 1];
  return {
    plan_label: payment.label,
    purchased_at: payment.createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    is_active: expiresAt > new Date(),
  };
}
