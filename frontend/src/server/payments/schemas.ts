import type { Payment } from '@prisma/client';

// Minimal subset of backend/src/app/modules/payments/schemas.py — just PaymentOut, used
// by guardian/admin/it_head dashboards. Order/checkout schemas are phase 6.
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
