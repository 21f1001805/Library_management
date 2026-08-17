from fastapi import HTTPException, status

from app.modules.permission_requests import repository
from app.modules.permission_requests.schemas import PermissionRequestCreate, PermissionRequestOut


async def list_pending_requests() -> list[PermissionRequestOut]:
    rows = await repository.list_pending()
    return [PermissionRequestOut.from_prisma(row) for row in rows]


async def create_request(
    requested_by_id: str, payload: PermissionRequestCreate
) -> PermissionRequestOut:
    row = await repository.create(
        requested_by_id=requested_by_id, permission=payload.permission, reason=payload.reason
    )
    return PermissionRequestOut.from_prisma(row)


async def grant_request(request_id: str, decided_by_id: str) -> PermissionRequestOut:
    return await _decide(request_id, decided_by_id, "granted")


async def deny_request(request_id: str, decided_by_id: str) -> PermissionRequestOut:
    return await _decide(request_id, decided_by_id, "denied")


async def _decide(request_id: str, decided_by_id: str, status_value: str) -> PermissionRequestOut:
    existing = await repository.find_by_id(request_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if existing.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This request has already been decided"
        )

    row = await repository.decide(request_id, status=status_value, decided_by_id=decided_by_id)
    return PermissionRequestOut.from_prisma(row)
