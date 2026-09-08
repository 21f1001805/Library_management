import type { Prisma } from '@prisma/client';

import { HttpError } from '@/server/http';
import type { AuthenticatedUser } from '@/server/auth/guards';
import * as repository from '@/server/notifications/repository';
import { notificationToJson, type NotificationOut } from '@/server/notifications/schemas';

// Mirrors backend/src/app/modules/notifications/service.py in full. The router (GET
// list, mark-read endpoints) is a later phase — this exists now because notify_roles is
// shared infrastructure several earlier-phase modules call directly.
export async function listMyNotifications(user: AuthenticatedUser): Promise<NotificationOut[]> {
  const notifications = await repository.listForUser(user.id);
  return notifications.map(notificationToJson);
}

export async function markAsRead(
  user: AuthenticatedUser,
  notificationId: string,
): Promise<NotificationOut> {
  const notification = await repository.find(notificationId);
  if (!notification) throw new HttpError(404, 'Notification not found');
  if (notification.userId !== user.id) {
    throw new HttpError(403, 'You cannot modify this notification');
  }
  const updated = await repository.markRead(notificationId);
  return notificationToJson(updated);
}

export async function markAllAsRead(user: AuthenticatedUser): Promise<NotificationOut[]> {
  await repository.markAllRead(user.id);
  return listMyNotifications(user);
}

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  client?: Prisma.TransactionClient,
): Promise<NotificationOut> {
  const created = await repository.create(userId, type, message, client);
  return notificationToJson(created);
}

export async function createNotifications(
  userIds: string[],
  type: string,
  message: string,
): Promise<void> {
  await repository.createMany(userIds, type, message);
}

// Notify every active user holding any of these roles — shared instead of each caller
// re-querying users by role itself.
export async function notifyRoles(roles: string[], type: string, message: string): Promise<void> {
  const userIds = await repository.listActiveUserIdsWithRoles(roles);
  await repository.createMany(userIds, type, message);
}
