import asyncio
from datetime import UTC, datetime
from typing import cast

from prisma.models import Payment, PricingPlan, User

from app.modules.it_head import repository
from app.modules.it_head.schemas import FeeStatusEntryOut, ITHeadDashboardOut, ITHeadStatsOut
from app.modules.loans import service as loans_service
from app.modules.payments import service as payments_service
from app.modules.permission_requests import repository as permission_requests_repository
from app.modules.pricing_plans import repository as pricing_plans_repository
from app.modules.support_tickets import repository as support_tickets_repository

# A renewal grace period, not a book-loan one — separate from loans.constants.LOAN_PERIOD_DAYS.
# Expired more recently than this shows as "due"; longer than this shows as "overdue".
RENEWAL_GRACE_DAYS = 7


async def get_dashboard() -> ITHeadDashboardOut:
    now = datetime.now(UTC)

    # Seven independent reads — issued concurrently rather than one after another,
    # the same way the admin dashboard does it. Kept to a fixed handful on purpose so
    # this cannot exhaust the connection pool.
    # gather() over heterogeneous awaitables widens everything to object, so each
    # result is cast back — the same pattern admin.get_dashboard uses.
    results = await asyncio.gather(
        repository.count_active_members(),
        support_tickets_repository.count_by_status("open"),
        permission_requests_repository.count_pending(),
        loans_service.sum_outstanding_fines(),
        repository.list_active_members(),
        repository.membership_payments_by_member(),
        pricing_plans_repository.list_all(),
    )
    active_members = cast(int, results[0])
    open_issues = cast(int, results[1])
    pending_permissions = cast(int, results[2])
    late_fines_outstanding = cast(int, results[3])
    members = cast(list[User], results[4])
    payments_by_member = cast(dict[str, list[Payment]], results[5])
    plans = cast(list[PricingPlan], results[6])

    renewal_price = next((plan.price for plan in plans if plan.planId == "1m"), 0)

    fee_status: list[FeeStatusEntryOut] = []
    fees_outstanding = 0
    for member in members:
        member_payments = payments_by_member.get(member.id) or []
        payment = member_payments[-1] if member_payments else None
        if payment is None:
            fee_status.append(
                FeeStatusEntryOut(
                    member_id=member.id,
                    member_name=member.fullName,
                    amount_due=renewal_price,
                    status="overdue",
                    due_date=member.createdAt,
                )
            )
            fees_outstanding += renewal_price
            continue

        # Shared with the member-facing view. The old 30-days-per-month approximation
        # here drifted days out on longer plans and ignored renewals entirely.
        expires_at = payments_service.calculate_membership_expiry(member_payments)
        if expires_at is None:
            expires_at = payment.createdAt
        if expires_at > now:
            fee_status.append(
                FeeStatusEntryOut(
                    member_id=member.id,
                    member_name=member.fullName,
                    amount_due=0,
                    status="paid",
                    due_date=None,
                )
            )
            continue

        days_overdue = (now - expires_at).days
        status_value = "overdue" if days_overdue > RENEWAL_GRACE_DAYS else "due"
        fee_status.append(
            FeeStatusEntryOut(
                member_id=member.id,
                member_name=member.fullName,
                amount_due=renewal_price,
                status=status_value,
                due_date=expires_at,
            )
        )
        fees_outstanding += renewal_price

    return ITHeadDashboardOut(
        stats=ITHeadStatsOut(
            active_members=active_members,
            open_issues=open_issues,
            pending_permissions=pending_permissions,
            fees_outstanding=fees_outstanding,
            late_fines_outstanding=late_fines_outstanding,
        ),
        fee_status=fee_status,
    )
