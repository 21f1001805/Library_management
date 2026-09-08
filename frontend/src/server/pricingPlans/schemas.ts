import { z } from 'zod';

import type { PricingPlan } from '@prisma/client';

// Mirrors backend/src/app/modules/pricing_plans/schemas.py.
export interface PricingPlanOut {
  id: string;
  plan_id: string;
  months: number;
  price: number;
  save_percent: number;
  badge: string | null;
  updated_at: string;
}

export function pricingPlanToJson(plan: PricingPlan): PricingPlanOut {
  return {
    id: plan.id,
    plan_id: plan.planId,
    months: plan.months,
    price: plan.price,
    save_percent: plan.savePercent,
    badge: plan.badge,
    updated_at: plan.updatedAt.toISOString(),
  };
}

export const pricingPlanUpdateSchema = z.object({
  price: z.number().int().positive(),
  save_percent: z.number().int().min(0).max(100),
});
export type PricingPlanUpdateInput = z.infer<typeof pricingPlanUpdateSchema>;
