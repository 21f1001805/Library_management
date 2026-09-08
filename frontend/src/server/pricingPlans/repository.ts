import type { PricingPlan } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/pricing_plans/repository.py in full.
export async function listAll(): Promise<PricingPlan[]> {
  return prisma.pricingPlan.findMany({ orderBy: { months: 'asc' } });
}

export async function findById(planId: string): Promise<PricingPlan | null> {
  return prisma.pricingPlan.findUnique({ where: { id: planId } });
}

export async function findByPlanCode(planCode: string): Promise<PricingPlan | null> {
  return prisma.pricingPlan.findUnique({ where: { planId: planCode } });
}

export async function findByMonths(months: number): Promise<PricingPlan | null> {
  return prisma.pricingPlan.findFirst({ where: { months } });
}

export async function update(
  planId: string,
  opts: { price: number; savePercent: number },
): Promise<PricingPlan> {
  return prisma.pricingPlan.update({
    where: { id: planId },
    data: { price: opts.price, savePercent: opts.savePercent },
  });
}
