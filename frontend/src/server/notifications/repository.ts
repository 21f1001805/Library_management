import type { Notification, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/notifications/repository.py in full — small and used
// as shared cross-cutting infrastructure by many modules (library reviews, permission
// requests, community moderation, ...) well before notifications gets its own router in
// a later phase.
const LIST_LIMIT = 200;

type PrismaTx = Prisma.TransactionClient;

export async function listForUser(userId: string): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
  });
}

export async function find(notificationId: string): Promise<Notification | null> {
  return prisma.notification.findUnique({ where: { id: notificationId } });
}

export async function create(
  userId: string,
  type: string,
  message: string,
  client?: PrismaTx,
): Promise<Notification> {
  const db = client ?? prisma;
  return db.notification.create({ data: { userId, type, message } });
}

export async function createMany(userIds: string[], type: string, message: string): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, message })),
  });
}

export async function listActiveUserIdsWithRoles(roleNames: string[]): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: { name: { in: roleNames } }, isActive: true, deletedAt: null },
  });
  return users.map((user) => user.id);
}

export async function markRead(notificationId: string): Promise<Notification> {
  return prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
