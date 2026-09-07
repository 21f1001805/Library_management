from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from prisma.models import User

from app.api.deps import get_current_user, require_role
from app.core.constants import Role
from app.modules.visits import events, service
from app.modules.visits.schemas import (
    CheckInCreate,
    CheckOutCreate,
    ChildVisitStatusOut,
    LibraryVisitOut,
    MemberVisitStatusOut,
)

router = APIRouter(prefix="/visits", tags=["visits"])

require_staff = require_role(Role.MANAGER, Role.LIBRARIAN, Role.ADMIN)
as_guardian = require_role(Role.GUARDIAN)


@router.post("/check-in", response_model=LibraryVisitOut, status_code=status.HTTP_201_CREATED)
async def check_in(
    payload: CheckInCreate,
    user: Annotated[User, Depends(require_staff)],
) -> LibraryVisitOut:
    return await service.check_in_member(user, payload.member_id)


@router.post("/check-out", response_model=LibraryVisitOut)
async def check_out(
    payload: CheckOutCreate,
    user: Annotated[User, Depends(require_staff)],
) -> LibraryVisitOut:
    return await service.check_out_member(user, payload.member_id)


@router.get("/active", response_model=list[LibraryVisitOut])
async def list_active_visits(
    _: Annotated[User, Depends(require_staff)],
) -> list[LibraryVisitOut]:
    return await service.list_active_visits()


@router.get("/export-csv")
async def export_active_visits_csv(
    _: Annotated[User, Depends(require_staff)],
) -> Response:
    from datetime import UTC, datetime

    csv_content = await service.export_active_visits_csv()
    today_str = datetime.now(UTC).strftime("%Y-%m-%d")
    filename = f"library-currently-present-{today_str}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/my-status", response_model=MemberVisitStatusOut)
async def get_my_status(
    user: Annotated[User, Depends(get_current_user)],
) -> MemberVisitStatusOut:
    return await service.get_member_status(user)


# Declared before nothing in particular, but note the path: "/my-status/stream" must not
# collide with "/my-status" — FastAPI matches the literal segments, so both coexist.
#
# No response_model: this returns an open text/event-stream, not a JSON body. Starlette's
# GZipMiddleware (registered in main.py) excludes text/event-stream by default, so frames
# reach the client as they're produced rather than sitting in a compression buffer — which
# is why the media_type here is load-bearing and not just cosmetic.
@router.get("/my-status/stream")
async def stream_my_status(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
) -> StreamingResponse:
    return StreamingResponse(
        events.subscribe_status(user.id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # nginx and most other reverse proxies buffer upstream responses by default,
            # which would hold frames back until the buffer fills. This opts this one
            # response out; harmless when no proxy is in front.
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/children-status", response_model=list[ChildVisitStatusOut])
async def get_children_status(
    guardian: Annotated[User, Depends(as_guardian)],
) -> list[ChildVisitStatusOut]:
    return await service.get_children_status(guardian)
