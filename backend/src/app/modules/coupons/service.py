import secrets
import string

from fastapi import HTTPException, status
from prisma.errors import UniqueViolationError

from app.modules.audit_log import service as audit_log_service
from app.modules.audit_log.constants import AuditAction
from app.modules.coupons import repository
from app.modules.coupons.schemas import CouponCreate, CouponOut, CouponValidationOut

CODE_LENGTH = 8
CODE_ALPHABET = string.ascii_uppercase + string.digits
MAX_GENERATION_ATTEMPTS = 5


def _generate_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


async def list_coupons() -> list[CouponOut]:
    rows = await repository.list_all()
    return [CouponOut.from_prisma(row) for row in rows]


async def generate_coupon(admin_id: str, payload: CouponCreate) -> CouponOut:
    for _ in range(MAX_GENERATION_ATTEMPTS):
        try:
            row = await repository.create(
                code=_generate_code(),
                discount_percent=payload.discount_percent,
                max_uses=payload.max_uses,
                created_by_id=admin_id,
            )
            break
        except UniqueViolationError:
            continue
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate a unique coupon code, try again",
        )

    await audit_log_service.record(
        actor_id=admin_id,
        action=AuditAction.COUPON_GENERATED,
        metadata={"code": row.code, "discountPercent": row.discountPercent, "maxUses": row.maxUses},
    )
    return CouponOut.from_prisma(row)


async def _find_valid_coupon(code: str):
    coupon = await repository.find_by_code(code.strip().upper())
    if coupon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
    if coupon.usesCount >= coupon.maxUses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Coupon has been fully redeemed"
        )
    return coupon


async def validate_coupon(code: str) -> CouponValidationOut:
    coupon = await _find_valid_coupon(code)
    return CouponValidationOut(code=coupon.code, discount_percent=coupon.discountPercent)


async def redeem_coupon(code: str, base_amount: int) -> int:
    # Only called from payment creation (not from the preview/"Apply" validation step),
    # so a use is only consumed once a payment actually goes through. ponytail: no
    # row locking, so two payments redeeming the last use at the same instant could
    # both succeed — an acceptable gap given there's no real payment gateway yet either.
    coupon = await _find_valid_coupon(code)
    await repository.increment_uses(coupon.id)
    return round(base_amount * (100 - coupon.discountPercent) / 100)
