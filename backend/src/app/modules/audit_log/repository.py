from typing import Any

from prisma import Json
from prisma.models import AuditLogEntry

from app.db.prisma import prisma

INCLUDE = {"actor": {"include": {"role": True}}}


async def create(*, actor_id: str, action: str, metadata: dict[str, Any]) -> AuditLogEntry:
    return await prisma.auditlogentry.create(
        data={"actorId": actor_id, "action": action, "metadata": Json(metadata)},
        include=INCLUDE,
    )


async def list_recent(*, limit: int) -> list[AuditLogEntry]:
    return await prisma.auditlogentry.find_many(
        take=limit, order={"createdAt": "desc"}, include=INCLUDE
    )
