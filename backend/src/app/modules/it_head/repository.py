from prisma.models import Payment, User

from app.core.constants import Role
from app.db.prisma import prisma


async def count_active_members() -> int:
    return await prisma.user.count(
        where={"role": {"name": Role.MEMBER}, "deletedAt": None, "isActive": True}
    )


async def list_active_members() -> list[User]:
    return await prisma.user.find_many(
        where={"role": {"name": Role.MEMBER}, "deletedAt": None, "isActive": True}
    )


async def list_membership_payments() -> list[Payment]:
    return await prisma.payment.find_many(
        where={"status": "success", "planMonths": {"not": None}}, order={"createdAt": "desc"}
    )


async def membership_payments_by_member() -> dict[str, list[Payment]]:
    """All successful plan payments per member, oldest first.

    Ascending order is what payments.calculate_membership_expiry expects, so this
    dashboard can share that function instead of re-deriving expiry from the latest
    payment with a 30-day month (which ignored renewals and drifted on long plans).
    """
    payments = await prisma.payment.find_many(
        where={"status": "success", "planMonths": {"not": None}}, order={"createdAt": "asc"}
    )
    grouped: dict[str, list[Payment]] = {}
    for payment in payments:
        grouped.setdefault(payment.userId, []).append(payment)
    return grouped
