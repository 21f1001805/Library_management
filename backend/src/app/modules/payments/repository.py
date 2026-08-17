from prisma.models import Payment

from app.db.prisma import prisma


async def create_payment(
    *, user_id: str, amount: int, label: str, plan_months: int | None = None
) -> Payment:
    return await prisma.payment.create(
        data={
            "userId": user_id,
            "amount": amount,
            "label": label,
            "planMonths": plan_months,
        },
    )


async def find_latest_membership_payment(user_id: str) -> Payment | None:
    return await prisma.payment.find_first(
        where={"userId": user_id, "planMonths": {"not": None}, "status": "success"},
        order={"createdAt": "desc"},
    )


async def list_payments_for_user(user_id: str) -> list[Payment]:
    return await prisma.payment.find_many(
        where={"userId": user_id}, order={"createdAt": "desc"}
    )
