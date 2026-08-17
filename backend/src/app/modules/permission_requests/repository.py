from datetime import UTC, datetime

from prisma.models import PermissionRequest

from app.db.prisma import prisma

INCLUDE = {"requestedBy": True, "decidedBy": True}


async def list_pending() -> list[PermissionRequest]:
    return await prisma.permissionrequest.find_many(
        where={"status": "pending"}, include=INCLUDE, order={"createdAt": "asc"}
    )


async def find_by_id(request_id: str) -> PermissionRequest | None:
    return await prisma.permissionrequest.find_unique(where={"id": request_id}, include=INCLUDE)


async def create(*, requested_by_id: str, permission: str, reason: str) -> PermissionRequest:
    return await prisma.permissionrequest.create(
        data={"requestedById": requested_by_id, "permission": permission, "reason": reason},
        include=INCLUDE,
    )


async def decide(request_id: str, *, status: str, decided_by_id: str) -> PermissionRequest:
    return await prisma.permissionrequest.update(
        where={"id": request_id},
        data={"status": status, "decidedById": decided_by_id, "decidedAt": datetime.now(UTC)},
        include=INCLUDE,
    )
