from datetime import UTC, datetime, timedelta

from app.modules.it_head import repository
from app.modules.it_head.schemas import FeeStatusEntryOut, ITHeadDashboardOut, ITHeadStatsOut
from app.modules.loans import service as loans_service
from app.modules.permission_requests import repository as permission_requests_repository
from app.modules.pricing_plans import repository as pricing_plans_repository
from app.modules.support_tickets import repository as support_tickets_repository

# A renewal grace period, not a book-loan one — separate from loans.constants.LOAN_PERIOD_DAYS.
# Expired more recently than this shows as "due"; longer than this shows as "overdue".
RENEWAL_GRACE_DAYS = 7


async def get_dashboard() -> ITHeadDashboardOut:
    now = datetime.now(UTC)

    active_members = await repository.count_active_members()
    open_issues = len(await support_tickets_repository.list_all(status="open"))
    pending_permissions = len(await permission_requests_repository.list_pending())
    late_fines_outstanding = await loans_service.sum_outstanding_fines()

    members = await repository.list_active_members()
    payments = await repository.list_membership_payments()

    # `payments` is already ordered newest-first, so the first payment seen per member
    # is their latest — no need to sort per-member.
    latest_payment_by_member: dict[str, object] = {}
    for payment in payments:
        latest_payment_by_member.setdefault(payment.userId, payment)

    plans = await pricing_plans_repository.list_all()
    renewal_price = next((plan.price for plan in plans if plan.planId == "1m"), 0)

    fee_status: list[FeeStatusEntryOut] = []
    fees_outstanding = 0
    for member in members:
        payment = latest_payment_by_member.get(member.id)
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

        # 30 days/month approximation — same simplification as payments/get_my_membership.
        expires_at = payment.createdAt + timedelta(days=30 * payment.planMonths)
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
