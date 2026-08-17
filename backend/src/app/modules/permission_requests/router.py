from typing import Annotated

from fastapi import APIRouter, Depends, status
from prisma.models import User

from app.api.deps import require_role
from app.core.constants import Role
from app.modules.permission_requests import service
from app.modules.permission_requests.schemas import PermissionRequestCreate, PermissionRequestOut

router = APIRouter(prefix="/permission-requests", tags=["permission-requests"])

file_request = require_role(Role.MANAGER, Role.LIBRARIAN)
decide_request = require_role(Role.IT_HEAD)


@router.get("", response_model=list[PermissionRequestOut])
async def list_requests(
    _: Annotated[User, Depends(decide_request)],
) -> list[PermissionRequestOut]:
    return await service.list_pending_requests()


@router.post("", response_model=PermissionRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: PermissionRequestCreate, user: Annotated[User, Depends(file_request)]
) -> PermissionRequestOut:
    return await service.create_request(user.id, payload)


@router.post("/{request_id}/grant", response_model=PermissionRequestOut)
async def grant_request(
    request_id: str, user: Annotated[User, Depends(decide_request)]
) -> PermissionRequestOut:
    return await service.grant_request(request_id, user.id)


@router.post("/{request_id}/deny", response_model=PermissionRequestOut)
async def deny_request(
    request_id: str, user: Annotated[User, Depends(decide_request)]
) -> PermissionRequestOut:
    return await service.deny_request(request_id, user.id)
