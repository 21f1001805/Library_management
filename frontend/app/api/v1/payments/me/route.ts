import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as paymentsService from '@/server/payments/service';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
});

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const url = new URL(request.url);
  const query = querySchema.parse({
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });
  const result = await paymentsService.listMyPayments(user.id, {
    page: query.page,
    pageSize: query.page_size,
  });
  return NextResponse.json(result);
});
