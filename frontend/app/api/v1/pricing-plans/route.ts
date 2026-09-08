import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import * as pricingPlansService from '@/server/pricingPlans/service';

export const GET = withErrorHandling(async () => {
  const plans = await pricingPlansService.listPlans();
  return NextResponse.json(plans);
});
