import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as notificationsService from '@/server/notifications/service';

export const POST = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser(request);
  const { notificationId } = await params;
  const notification = await notificationsService.markAsRead(user, notificationId as string);
  return NextResponse.json(notification);
});
