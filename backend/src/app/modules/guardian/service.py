from fastapi import HTTPException, status
from prisma.errors import ForeignKeyViolationError, UniqueViolationError
from prisma.models import User

from app.core.constants import Role
from app.modules.guardian import repository
from app.modules.guardian.schemas import GuardianChildOut, GuardianLinkCreate
from app.modules.loans import service as loans_service
from app.modules.members import repository as members_repository
from app.modules.members.schemas import ReadingProgressOut
from app.modules.notifications import service as notifications_service
from app.modules.payments import repository as payments_repository
from app.modules.payments import service as payments_service
from app.modules.payments.schemas import PaymentOut
from app.modules.pricing_plans import repository as pricing_plans_repository
from app.modules.seat_booking import service as seat_booking_service
from app.modules.seat_booking.schemas import (
    SeatBookingCreate,
    SeatBookingOut,
    SeatNotifyCreate,
)

RENEWAL_PLAN_CODE = "1m"


async def link_child(payload: GuardianLinkCreate) -> None:
    guardian = await members_repository.find_by_id(payload.guardian_id)
    child = await members_repository.find_by_id(payload.member_id)
    if guardian is None or child is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guardian or member not found",
        )
    if (
        guardian.role is None
        or guardian.role.name != Role.GUARDIAN
        or not guardian.isActive
        or guardian.deletedAt is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Guardian must be an active guardian account",
        )
    if (
        child.role is None
        or child.role.name != Role.MEMBER
        or not child.isActive
        or child.deletedAt is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Child must be an active member account",
        )

    try:
        await repository.create_link(guardian_id=payload.guardian_id, member_id=payload.member_id)
    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This member already has a guardian",
        ) from exc
    except ForeignKeyViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guardian or member not found",
        ) from exc


async def _find_child_or_403(guardian_id: str, child_id: str) -> User:
    children = await repository.list_children(guardian_id)
    child = next((c for c in children if c.id == child_id), None)
    if child is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This member isn't linked to you"
        )
    return child


async def _child_out(child: User) -> GuardianChildOut:
    child_progress = await members_repository.list_reading_progress(child.id)
    progress = [ReadingProgressOut.from_prisma(p) for p in child_progress]

    loans = await loans_service.list_my_loans(child.id)
    unpaid = [loan for loan in loans if loan.fine_amount > 0 and not loan.fine_paid]
    outstanding_fine = sum(loan.fine_amount for loan in unpaid)
    worst_loan = max(unpaid, key=lambda loan: loan.days_late, default=None)

    membership_payments = await payments_repository.list_membership_payments(child.id)
    subscription_expires_on = payments_service.calculate_membership_expiry(membership_payments)

    return GuardianChildOut(
        id=child.id,
        full_name=child.fullName,
        email=child.email,
        currently_reading=[p for p in progress if p.status == "reading"],
        completed=[p for p in progress if p.status == "completed"],
        outstanding_fine=outstanding_fine,
        fine_book_title=worst_loan.book_title if worst_loan else None,
        fine_due_date=worst_loan.due_date if worst_loan else None,
        subscription_expires_on=subscription_expires_on,
    )


async def list_my_children(guardian_id: str) -> list[GuardianChildOut]:
    children = await repository.list_children(guardian_id)
    return [await _child_out(child) for child in children]


async def list_child_payments(guardian_id: str, child_id: str) -> list[PaymentOut]:
    child = await _find_child_or_403(guardian_id, child_id)
    # This view isn't paginated itself (a guardian has few children, each with a short
    # history) — page_size just mirrors the old hard cap so behavior is unchanged.
    payments, _total = await payments_repository.list_payments_for_user(
        child.id, page=1, page_size=200
    )
    return [PaymentOut.from_prisma(payment) for payment in payments]


async def pay_child_fines(guardian_id: str, child_id: str) -> None:
    child = await _find_child_or_403(guardian_id, child_id)

    loans = await loans_service.list_my_loans(child.id)
    unpaid = [loan for loan in loans if loan.fine_amount > 0 and not loan.fine_paid]
    if not unpaid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No outstanding fines for this child")

    total = sum(loan.fine_amount for loan in unpaid)
    # This endpoint is a request to pay at the library, not proof that money moved.
    # Only a verified gateway callback or staff cash-reconciliation flow may settle a
    # loan/create a successful Payment row.
    await notifications_service.notify_roles(
        [Role.MANAGER],
        "payment-pending",
        f"A guardian wants to pay ₹{total} in cash to clear fines for {child.fullName}.",
    )


async def renew_child_subscription(guardian_id: str, child_id: str) -> None:
    child = await _find_child_or_403(guardian_id, child_id)

    plan = await pricing_plans_repository.find_by_plan_code(RENEWAL_PLAN_CODE)
    if plan is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No renewal plan configured")

    # Preserve the 204 request contract, but do not grant membership before payment.
    await notifications_service.notify_roles(
        [Role.MANAGER],
        "payment-pending",
        f"A guardian wants to pay ₹{plan.price} in cash for a {plan.months}-month "
        f"membership renewal for {child.fullName}.",
    )


async def book_seat_for_child(
    guardian_id: str, child_id: str, payload: SeatBookingCreate
) -> SeatBookingOut:
    child = await _find_child_or_403(guardian_id, child_id)
    return await seat_booking_service.book_seat(child, payload)


async def request_seat_notify_for_child(
    guardian_id: str, child_id: str, payload: SeatNotifyCreate
) -> None:
    child = await _find_child_or_403(guardian_id, child_id)
    await seat_booking_service.request_notify(child, payload)
