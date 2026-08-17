from collections import defaultdict
from datetime import UTC, datetime, timedelta

from app.modules.admin import repository
from app.modules.admin.constants import EXPENSE_BUDGETS, OPEN_HOURS, ExpenseCategory
from app.modules.admin.schemas import (
    AdminDashboardOut,
    AdminMemberListOut,
    AdminMemberOut,
    AdminPaymentListOut,
    AdminPaymentOut,
    AdminStatsOut,
    AnnouncementCreate,
    AnnouncementOut,
    BudgetCategoryOut,
    ExpenseBreakdownItemOut,
    ExpenseBreakdownOut,
    ExpenseCreate,
    ExpenseOut,
    MembershipGrowthMonthOut,
    MembershipGrowthOut,
    MonthlyFigureOut,
    ProfitAndLossOut,
    RevenueByPlanItemOut,
    RevenueByPlanOut,
    RevenueSourceOut,
    SeatOccupancySlotOut,
    SeatStatusOut,
    TrendOut,
)
from app.modules.audit_log import service as audit_log_service
from app.modules.audit_log.constants import AuditAction
from app.modules.notifications import service as notifications_service
from app.modules.seat_booking.constants import SEAT_LABELS

TOTAL_SEATS = len(SEAT_LABELS)
REPORT_MONTHS = 6


def _month_start(moment: datetime) -> datetime:
    return datetime(moment.year, moment.month, 1, tzinfo=UTC)


def _previous_month_start(moment: datetime) -> datetime:
    last_day_of_previous_month = _month_start(moment) - timedelta(days=1)
    return _month_start(last_day_of_previous_month)


def _trend(current: int, previous: int) -> TrendOut:
    if previous == 0:
        return TrendOut(direction="up", percent=100 if current > 0 else 0)
    percent = round(abs(current - previous) / previous * 100)
    return TrendOut(direction="up" if current >= previous else "down", percent=percent)


def _month_key(moment: datetime) -> str:
    return f"{moment.year:04d}-{moment.month:02d}"


def _recent_month_starts(count: int, now: datetime) -> list[datetime]:
    starts = []
    cursor = _month_start(now)
    for _ in range(count):
        starts.append(cursor)
        cursor = _previous_month_start(cursor)
    starts.reverse()
    return starts


async def get_dashboard() -> AdminDashboardOut:
    now = datetime.now(UTC)
    this_month_start = _month_start(now)
    last_month_start = _previous_month_start(now)

    revenue_mtd = await repository.sum_payments(start=this_month_start)
    revenue_last_month = await repository.sum_payments(start=last_month_start, end=this_month_start)
    membership_fees = await repository.sum_payments(start=this_month_start, has_plan=True)
    fines_collected = await repository.sum_payments(start=this_month_start, has_plan=False)

    expenses_mtd = await repository.sum_expenses(start=this_month_start)
    expenses_last_month = await repository.sum_expenses(
        start=last_month_start, end=this_month_start
    )

    net_profit_mtd = revenue_mtd - expenses_mtd
    net_profit_last_month = revenue_last_month - expenses_last_month

    total_members = await repository.count_members()
    total_members_last_month = await repository.count_members(created_before=this_month_start)

    budget = [
        BudgetCategoryOut(
            category=category,
            budgeted=budgeted,
            spent=await repository.sum_expenses(start=this_month_start, category=category.value),
        )
        for category, budgeted in EXPENSE_BUDGETS.items()
    ]

    today = now.date()
    yesterday = today - timedelta(days=1)
    today_midnight = datetime(today.year, today.month, today.day, tzinfo=UTC)
    yesterday_midnight = datetime(yesterday.year, yesterday.month, yesterday.day, tzinfo=UTC)

    booked_this_hour = await repository.count_seat_bookings(date=today_midnight, hour=now.hour)
    seat_status = SeatStatusOut(
        available=TOTAL_SEATS - booked_this_hour, booked=booked_this_hour, total=TOTAL_SEATS
    )

    seat_occupancy = [
        SeatOccupancySlotOut(
            hour=hour,
            percent_filled=round(
                await repository.count_seat_bookings(date=yesterday_midnight, hour=hour)
                / TOTAL_SEATS
                * 100
            ),
        )
        for hour in OPEN_HOURS
    ]

    return AdminDashboardOut(
        stats=AdminStatsOut(
            revenue_mtd=revenue_mtd,
            revenue_trend=_trend(revenue_mtd, revenue_last_month),
            expenses_mtd=expenses_mtd,
            expenses_trend=_trend(expenses_mtd, expenses_last_month),
            net_profit_mtd=net_profit_mtd,
            net_profit_trend=_trend(net_profit_mtd, net_profit_last_month),
            total_members=total_members,
            total_members_trend=_trend(total_members, total_members_last_month),
        ),
        cash_flow=[
            RevenueSourceOut(source="membershipFees", amount=membership_fees),
            RevenueSourceOut(source="eventTickets", amount=0),
            RevenueSourceOut(source="finesCollected", amount=fines_collected),
            RevenueSourceOut(source="donationsValue", amount=0),
        ],
        budget=budget,
        seat_status=seat_status,
        seat_occupancy=seat_occupancy,
    )


async def log_expense(user_id: str, payload: ExpenseCreate) -> ExpenseOut:
    expense = await repository.create_expense(
        category=payload.category.value, amount=payload.amount, logged_by_id=user_id
    )
    await audit_log_service.record(
        actor_id=user_id,
        action=AuditAction.EXPENSE_LOGGED,
        metadata={"category": payload.category.value, "amount": payload.amount},
    )
    return ExpenseOut.from_prisma(expense)


async def get_revenue_by_plan() -> RevenueByPlanOut:
    payments = await repository.list_plan_payments()

    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for payment in payments:
        bucket = totals[payment.label]
        bucket[0] += payment.amount
        bucket[1] += 1

    items = [
        RevenueByPlanItemOut(label=label, amount=amount, count=count)
        for label, (amount, count) in totals.items()
    ]
    items.sort(key=lambda item: item.amount, reverse=True)

    return RevenueByPlanOut(items=items, total=sum(item.amount for item in items))


async def get_profit_and_loss() -> ProfitAndLossOut:
    now = datetime.now(UTC)
    month_starts = _recent_month_starts(REPORT_MONTHS, now)

    payments = await repository.list_payments_since(month_starts[0])
    expenses = await repository.list_expenses(start=month_starts[0])

    revenue_by_month: dict[str, int] = defaultdict(int)
    for payment in payments:
        revenue_by_month[_month_key(payment.createdAt)] += payment.amount

    expenses_by_month: dict[str, int] = defaultdict(int)
    for expense in expenses:
        expenses_by_month[_month_key(expense.createdAt)] += expense.amount

    months = [
        MonthlyFigureOut(
            month=_month_key(start),
            revenue=revenue_by_month.get(_month_key(start), 0),
            expenses=expenses_by_month.get(_month_key(start), 0),
            net_profit=revenue_by_month.get(_month_key(start), 0)
            - expenses_by_month.get(_month_key(start), 0),
        )
        for start in month_starts
    ]

    total_revenue = sum(month.revenue for month in months)
    total_expenses = sum(month.expenses for month in months)

    return ProfitAndLossOut(
        months=months,
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        total_net_profit=total_revenue - total_expenses,
    )


async def get_expense_breakdown() -> ExpenseBreakdownOut:
    expenses = await repository.list_expenses()

    totals: dict[str, int] = defaultdict(int)
    for expense in expenses:
        totals[expense.category] += expense.amount

    total = sum(totals.values())
    items = [
        ExpenseBreakdownItemOut(
            category=ExpenseCategory(category),
            amount=amount,
            percent=round(amount / total * 100, 1) if total else 0,
        )
        for category, amount in totals.items()
    ]
    items.sort(key=lambda item: item.amount, reverse=True)

    return ExpenseBreakdownOut(items=items, total=total)


async def get_membership_growth() -> MembershipGrowthOut:
    now = datetime.now(UTC)
    month_starts = _recent_month_starts(REPORT_MONTHS, now)
    earliest = month_starts[0]

    created_dates = await repository.list_member_created_dates()

    baseline = 0
    new_by_month: dict[str, int] = defaultdict(int)
    for created_at in created_dates:
        if created_at < earliest:
            baseline += 1
        else:
            new_by_month[_month_key(created_at)] += 1

    months = []
    running_total = baseline
    for start in month_starts:
        key = _month_key(start)
        new_members = new_by_month.get(key, 0)
        running_total += new_members
        months.append(
            MembershipGrowthMonthOut(
                month=key, new_members=new_members, total_members=running_total
            )
        )

    return MembershipGrowthOut(months=months)


async def send_announcement(admin_id: str, payload: AnnouncementCreate) -> AnnouncementOut:
    member_ids = await repository.list_member_ids()
    for member_id in member_ids:
        await notifications_service.create_notification(member_id, "announcement", payload.message)

    await audit_log_service.record(
        actor_id=admin_id,
        action=AuditAction.ANNOUNCEMENT_SENT,
        metadata={"recipientCount": len(member_ids)},
    )
    return AnnouncementOut(recipient_count=len(member_ids))


async def list_members(*, search: str | None, page: int, page_size: int) -> AdminMemberListOut:
    users, total = await repository.list_members(search=search, page=page, page_size=page_size)
    member_ids = [user.id for user in users]

    latest_payments = await repository.list_latest_payments(member_ids)
    latest_plan_payments = await repository.list_latest_membership_payments(member_ids)
    progress_counts = await repository.count_reading_progress_by_status(member_ids)
    reported_ids = await repository.find_reported_member_ids(member_ids)
    event_registration_counts = await repository.count_event_registrations(member_ids)

    now = datetime.now(UTC)
    items = []
    for user in users:
        last_payment = latest_payments.get(user.id)
        plan_payment = latest_plan_payments.get(user.id)

        plan_expires_at = None
        plan_is_active = False
        if plan_payment is not None:
            # ponytail: same 30-days/month approximation as payments/router.py's
            # get_my_membership — no real membership/plan model exists yet.
            plan_expires_at = plan_payment.createdAt + timedelta(
                days=30 * plan_payment.planMonths
            )
            plan_is_active = plan_expires_at > now

        counts = progress_counts.get(user.id, {})

        items.append(
            AdminMemberOut(
                id=user.id,
                full_name=user.fullName,
                email=user.email,
                role=user.role.name,
                is_active=user.isActive,
                joined_at=user.createdAt,
                last_payment_amount=last_payment.amount if last_payment else None,
                last_payment_label=last_payment.label if last_payment else None,
                last_payment_at=last_payment.createdAt if last_payment else None,
                plan_label=plan_payment.label if plan_payment else None,
                plan_expires_at=plan_expires_at,
                plan_is_active=plan_is_active,
                books_reading=counts.get("reading", 0),
                books_completed=counts.get("completed", 0),
                reported=user.id in reported_ids,
                event_registrations=event_registration_counts.get(user.id, 0),
            )
        )

    return AdminMemberListOut(items=items, total=total, page=page, page_size=page_size)


async def list_payments(*, search: str | None, page: int, page_size: int) -> AdminPaymentListOut:
    payments, total = await repository.list_payments(search=search, page=page, page_size=page_size)

    items = [
        AdminPaymentOut(
            id=payment.id,
            member_id=payment.userId,
            member_name=payment.user.fullName,
            member_email=payment.user.email,
            amount=payment.amount,
            label=payment.label,
            status=payment.status,
            plan_months=payment.planMonths,
            created_at=payment.createdAt,
        )
        for payment in payments
    ]
    return AdminPaymentListOut(items=items, total=total, page=page, page_size=page_size)
