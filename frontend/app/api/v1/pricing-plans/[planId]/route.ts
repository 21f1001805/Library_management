import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { pricingPlanUpdateSchema } from '@/server/pricingPlans/schemas';
import * as pricingPlansService from '@/server/pricingPlans/service';

export const PATCH = withErrorHandling(async (request, { params }) => {
  const user = await requireRole(request, Role.ADMIN);
  const { planId } = await params;
  const payload = pricingPlanUpdateSchema.parse(await readJsonBody(request));
  const plan = await pricingPlansService.updatePlan(planId as string, user.id, payload);
  return NextResponse.json(plan);
});
