import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { announcementCreateSchema } from '@/server/admin/schemas';
import * as adminService from '@/server/admin/service';

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.ADMIN);
  const payload = announcementCreateSchema.parse(await readJsonBody(request));
  const result = await adminService.sendAnnouncement(user.id, payload);
  return NextResponse.json(result, { status: 201 });
});
