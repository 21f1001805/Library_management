import { HttpError } from '@/server/http';
import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as repository from '@/server/pricingPlans/repository';
import {
  pricingPlanToJson,
  type PricingPlanOut,
  type PricingPlanUpdateInput,
} from '@/server/pricingPlans/schemas';

// Mirrors backend/src/app/modules/pricing_plans/service.py.
export async function listPlans(): Promise<PricingPlanOut[]> {
  const rows = await repository.listAll();
  return rows.map(pricingPlanToJson);
}

export async function updatePlan(
  planId: string,
  adminId: string,
  payload: PricingPlanUpdateInput,
): Promise<PricingPlanOut> {
  const existing = await repository.findById(planId);
  if (!existing) throw new HttpError(404, 'Plan not found');

  const row = await repository.update(planId, { price: payload.price, savePercent: payload.save_percent });
  await auditLogService.record({
    actorId: adminId,
    action: AuditAction.PRICING_PLAN_UPDATED,
    metadata: { planId: row.planId, price: row.price },
  });
  return pricingPlanToJson(row);
}
