import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { enforceRateLimit } from '@/server/rateLimit';
import { Role } from '@/server/constants';
import * as notificationsService from '@/server/notifications/service';
import { contactMessageCreateSchema } from '@/server/contact/schemas';

// Mirrors backend/src/app/modules/contact/router.py.
const RECIPIENT_ROLES = [Role.ADMIN, Role.IT_HEAD];

export const POST = withErrorHandling(async (request) => {
  await enforceRateLimit(request, 'contact:submit', 5, 60);
  const payload = contactMessageCreateSchema.parse(await readJsonBody(request));
  const message =
    `${payload.name} (${payload.email}, ${payload.phone_number}) at ${payload.organization} ` +
    `— ${payload.subject}\n\n${payload.message}`;
  await notificationsService.notifyRoles(RECIPIENT_ROLES, 'contact-message', message);
  return new NextResponse(null, { status: 204 });
});
