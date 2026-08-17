from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, status
from prisma.models import User

from app.api.deps import get_current_user
from app.core.constants import Role
from app.db.prisma import prisma
from app.modules.coupons import service as coupons_service
from app.modules.notifications import service as notifications_service
from app.modules.payments import repository
from app.modules.payments.schemas import MembershipOut, PaymentCreate, PaymentOut

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    user: Annotated[User, Depends(get_current_user)],
) -> PaymentOut:
    amount = payload.amount
    if payload.coupon_code:
        amount = await coupons_service.redeem_coupon(payload.coupon_code, payload.amount)

    payment = await repository.create_payment(
        user_id=user.id,
        amount=amount,
        label=payload.label,
        plan_months=payload.plan_months,
    )
    await notifications_service.create_notification(
        user.id, "payment-received", f"Payment of ₹{amount} received for {payload.label}."
    )
    return PaymentOut.from_prisma(payment)


@router.post("/pay-at-library", status_code=status.HTTP_204_NO_CONTENT)
async def pay_at_library(
    payload: PaymentCreate,
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    managers = await prisma.user.find_many(
        where={"role": {"name": Role.MANAGER}, "deletedAt": None}
    )
    message = f"{user.fullName} wants to pay ₹{payload.amount} in cash for {payload.label}."
    for manager in managers:
        await notifications_service.create_notification(manager.id, "payment-pending", message)


@router.get("/me", response_model=list[PaymentOut])
async def list_my_payments(
    user: Annotated[User, Depends(get_current_user)],
) -> list[PaymentOut]:
    payments = await repository.list_payments_for_user(user.id)
    return [PaymentOut.from_prisma(payment) for payment in payments]


@router.get("/me/membership", response_model=MembershipOut | None)
async def get_my_membership(
    user: Annotated[User, Depends(get_current_user)],
) -> MembershipOut | None:
    payment = await repository.find_latest_membership_payment(user.id)
    if payment is None:
        return None

    # ponytail: 30 days/month approximation, no calendar-month arithmetic in the
    # stdlib and this doesn't stack overlapping renewals — good enough until a real
    # membership/plan model exists (see FINAL_SPEC.md item 10).
    expires_at = payment.createdAt + timedelta(days=30 * payment.planMonths)
    return MembershipOut(
        plan_label=payment.label,
        purchased_at=payment.createdAt,
        expires_at=expires_at,
        is_active=expires_at > datetime.now(UTC),
    )
