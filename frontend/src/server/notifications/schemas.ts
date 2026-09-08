import type { Notification } from '@prisma/client';

// Mirrors backend/src/app/modules/notifications/schemas.py.
export interface NotificationOut {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function notificationToJson(notification: Notification): NotificationOut {
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    read: notification.read,
    created_at: notification.createdAt.toISOString(),
  };
}
