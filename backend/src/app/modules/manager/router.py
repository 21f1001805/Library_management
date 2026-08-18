from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from prisma.models import User

from app.api.deps import require_role
from app.core.constants import Role
from app.modules.loans.schemas import LoanOut
from app.modules.manager import service
from app.modules.manager.schemas import (
    ManagerBookListOut,
    ManagerDashboardStatsOut,
    ManagerGuardianLinkCreate,
    ManagerLoanCreate,
    ManagerReservationDecision,
    ManagerSeatBookingCreate,
    PendingReservationOut,
)
from app.modules.reservations.schemas import ReservationOut
from app.modules.seat_booking.schemas import SeatBookingOut

router = APIRouter(prefix="/manager", tags=["manager"])

manage = require_role(Role.MANAGER, Role.LIBRARIAN)


@router.get("/dashboard", response_model=ManagerDashboardStatsOut)
async def get_dashboard(_: Annotated[User, Depends(manage)]) -> ManagerDashboardStatsOut:
    return await service.get_dashboard_stats()


@router.post("/seat-bookings", response_model=SeatBookingOut, status_code=status.HTTP_201_CREATED)
async def book_seat_for_member(
    payload: ManagerSeatBookingCreate, _: Annotated[User, Depends(manage)]
) -> SeatBookingOut:
    return await service.book_seat_for_member(payload)


# Manager-scoped convenience wrapper around the same loans_service.create_loan used by
# POST /loans (ADMIN/MANAGER/LIBRARIAN/IT_HEAD) — see manager/service.py. Both are
# intentionally reachable by a manager: this one is the front-desk flow (issue while a
# member is standing there), POST /loans is the general staff endpoint.
@router.post("/loans", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
async def issue_loan_for_member(
    payload: ManagerLoanCreate, user: Annotated[User, Depends(manage)]
) -> LoanOut:
    return await service.issue_loan_for_member(user.id, payload)


@router.post("/guardian-links", status_code=status.HTTP_204_NO_CONTENT)
async def link_guardian(
    payload: ManagerGuardianLinkCreate, _: Annotated[User, Depends(manage)]
) -> None:
    await service.link_guardian(payload)


@router.get("/books", response_model=ManagerBookListOut)
async def list_book_availability(
    _: Annotated[User, Depends(manage)],
    search: Annotated[str | None, Query(description="Match against title or author")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ManagerBookListOut:
    return await service.list_book_availability(search=search, page=page, page_size=page_size)


@router.get("/reservations/pending", response_model=list[PendingReservationOut])
async def list_pending_reservations(
    _: Annotated[User, Depends(manage)],
) -> list[PendingReservationOut]:
    return await service.list_pending_reservations()


@router.post("/reservations/{reservation_id}/approve", response_model=ReservationOut)
async def approve_reservation(
    reservation_id: str,
    payload: ManagerReservationDecision,
    user: Annotated[User, Depends(manage)],
) -> ReservationOut:
    return await service.approve_reservation(user.id, reservation_id, payload.duration_days)


@router.post("/reservations/{reservation_id}/reject", response_model=ReservationOut)
async def reject_reservation(
    reservation_id: str, _: Annotated[User, Depends(manage)]
) -> ReservationOut:
    return await service.reject_reservation(reservation_id)
