import type { PricingPlan } from '@prisma/client';

import { prisma } from '@/server/db';

// Minimal subset of backend/src/app/modules/pricing_plans/repository.py — the lookups
// guardian/payments-adjacent code needs. The plan-management router (update price/save
// percent) is phase 6.
export async function listAll(): Promise<PricingPlan[]> {
  return prisma.pricingPlan.findMany({ orderBy: { months: 'asc' } });
}

export async function findByPlanCode(planCode: string): Promise<PricingPlan | null> {
  return prisma.pricingPlan.findUnique({ where: { planId: planCode } });
}

export async function findByMonths(months: number): Promise<PricingPlan | null> {
  return prisma.pricingPlan.findFirst({ where: { months } });
}
