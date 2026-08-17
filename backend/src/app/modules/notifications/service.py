from fastapi import HTTPException, status
from prisma.models import User

from app.modules.notifications import repository
from app.modules.notifications.schemas import NotificationOut


async def list_my_notifications(user: User) -> list[NotificationOut]:
    notifications = await repository.list_for_user(user.id)
    return [NotificationOut.from_prisma(n) for n in notifications]


async def mark_as_read(user: User, notification_id: str) -> NotificationOut:
    notification = await repository.find(notification_id)
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notification.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot modify this notification")

    updated = await repository.mark_read(notification_id)
    return NotificationOut.from_prisma(updated)


async def mark_all_as_read(user: User) -> list[NotificationOut]:
    await repository.mark_all_read(user.id)
    return await list_my_notifications(user)


async def create_notification(user_id: str, type_: str, message: str) -> NotificationOut:
    created = await repository.create(user_id, type_, message)
    return NotificationOut.from_prisma(created)
