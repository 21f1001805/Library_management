import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { memberUpdateSchema } from '@/server/members/schemas';
import * as membersService from '@/server/members/service';

// Mirrors backend/src/app/modules/members/router.py.

export const PUT = withErrorHandling(async (request, { params }) => {
  const actor = await requireRole(request, Role.ADMIN);
  const { memberId } = await params;
  const payload = memberUpdateSchema.parse(await readJsonBody(request));
  const member = await membersService.updateMember(memberId as string, payload, actor.id);
  return NextResponse.json(member);
});
