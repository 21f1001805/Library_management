import { z } from 'zod';

import type { Payment } from '@prisma/client';

// Mirrors backend/src/app/modules/payments/schemas.py in full — PaymentOut was already
// ported in phase 5 for dashboards; the rest is what phase 6's order/verify flow needs.
export const paymentCreateSchema = z.object({
  amount: z.number().int().positive(),
  label: z.string().min(1).max(255),
  plan_months: z.number().int().positive().nullable().optional(),
  coupon_code: z.string().min(1).max(20).nullable().optional(),
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export interface PaymentOut {
  id: string;
  amount: number;
  label: string;
  status: string;
  created_at: string;
}

export function paymentToJson(payment: Payment): PaymentOut {
  return {
    id: payment.id,
    amount: payment.amount,
    label: payment.label,
    status: payment.status,
    created_at: payment.createdAt.toISOString(),
  };
}

export interface PaymentListResponse {
  items: PaymentOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface MembershipOut {
  plan_label: string;
  purchased_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface RazorpayOrderOut {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  label: string;
}

export const razorpayVerifyRequestSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type RazorpayVerifyRequestInput = z.infer<typeof razorpayVerifyRequestSchema>;
