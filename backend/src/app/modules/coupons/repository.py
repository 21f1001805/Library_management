from prisma.models import Coupon

from app.db.prisma import prisma


async def list_all() -> list[Coupon]:
    return await prisma.coupon.find_many(order={"createdAt": "desc"})


async def find_by_code(code: str) -> Coupon | None:
    return await prisma.coupon.find_unique(where={"code": code})


async def create(*, code: str, discount_percent: int, max_uses: int, created_by_id: str) -> Coupon:
    return await prisma.coupon.create(
        data={
            "code": code,
            "discountPercent": discount_percent,
            "maxUses": max_uses,
            "createdById": created_by_id,
        }
    )


async def increment_uses(coupon_id: str) -> Coupon:
    return await prisma.coupon.update(
        where={"id": coupon_id}, data={"usesCount": {"increment": 1}}
    )
