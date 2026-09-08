import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as notificationsService from '@/server/notifications/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const notifications = await notificationsService.listMyNotifications(user);
  return NextResponse.json(notifications);
});
