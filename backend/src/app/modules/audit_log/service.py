from typing import Any

from app.modules.audit_log import repository
from app.modules.audit_log.schemas import AuditLogEntryOut


async def record(*, actor_id: str, action: str, metadata: dict[str, Any]) -> None:
    await repository.create(actor_id=actor_id, action=action, metadata=metadata)


async def list_entries(*, limit: int = 20) -> list[AuditLogEntryOut]:
    rows = await repository.list_recent(limit=limit)
    return [AuditLogEntryOut.from_prisma(row) for row in rows]
