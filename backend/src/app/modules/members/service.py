from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from prisma.errors import ForeignKeyViolationError, UniqueViolationError

from app.core.security import hash_password
from app.modules.members import repository
from app.modules.members.schemas import (
    MemberCreate,
    MemberListResponse,
    MemberOut,
    MemberUpdate,
    ReadingGoalOut,
    ReadingGoalUpsert,
    ReadingProgressOut,
    ReadingProgressUpsert,
    ReadingStreakOut,
)


async def list_members(
    *,
    search: str | None,
    page: int,
    page_size: int,
    role: str | None = None,
    active_only: bool = False,
) -> MemberListResponse:
    items, total = await repository.list_members(
        search=search, page=page, page_size=page_size, role=role, active_only=active_only
    )
    return MemberListResponse(
        items=[MemberOut.from_prisma(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


async def create_member(payload: MemberCreate) -> MemberOut:
    role = await repository.upsert_role(payload.role_name)

    try:
        user = await repository.create_member(
            email=payload.email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
            phone=payload.phone,
            avatar_url=payload.avatar_url,
            role_id=role.id,
        )
    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A member with this email already exists",
        ) from exc

    return MemberOut.from_prisma(user)


async def update_member(member_id: str, payload: MemberUpdate) -> MemberOut:
    existing = await repository.find_by_id(member_id)
    if existing is None or existing.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    fields_set = payload.model_fields_set
    data: dict = {}
    if payload.full_name is not None:
        data["fullName"] = payload.full_name
    if "phone" in fields_set:
        data["phone"] = payload.phone
    if "avatar_url" in fields_set:
        data["avatarUrl"] = payload.avatar_url
    if payload.is_active is not None:
        data["isActive"] = payload.is_active
    if payload.role_name is not None:
        role = await repository.upsert_role(payload.role_name)
        data["roleId"] = role.id

    if not data:
        return MemberOut.from_prisma(existing)

    updated = await repository.update_member(member_id, data)
    return MemberOut.from_prisma(updated)


async def list_reading_progress(member_id: str) -> list[ReadingProgressOut]:
    items = await repository.list_reading_progress(member_id)
    return [ReadingProgressOut.from_prisma(item) for item in items]


async def record_reading_progress(
    member_id: str, payload: ReadingProgressUpsert
) -> ReadingProgressOut:
    try:
        progress = await repository.upsert_reading_progress(
            member_id=member_id,
            book_id=payload.book_id,
            status=payload.status,
            percent_complete=payload.percent_complete,
        )
    except ForeignKeyViolationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found") from exc

    return ReadingProgressOut.from_prisma(progress)


async def get_reading_goal(member_id: str) -> ReadingGoalOut | None:
    goal = await repository.get_reading_goal(member_id)
    if goal is None:
        return None
    return await _build_reading_goal_out(member_id, goal)


async def upsert_reading_goal(member_id: str, payload: ReadingGoalUpsert) -> ReadingGoalOut:
    goal = await repository.upsert_reading_goal(
        member_id=member_id,
        yearly_goal=payload.yearly_goal,
        monthly_goal=payload.monthly_goal,
    )
    return await _build_reading_goal_out(member_id, goal)


async def _build_reading_goal_out(member_id: str, goal) -> ReadingGoalOut:
    # ponytail: "completed this year/month" uses ReadingProgress.updatedAt as a proxy for
    # completion date (no separate completedAt column) — good enough until Loan/borrow
    # history exists to derive a real completion timestamp.
    now = datetime.now(UTC)
    year_start = datetime(now.year, 1, 1, tzinfo=UTC)
    month_start = datetime(now.year, now.month, 1, tzinfo=UTC)

    completed_this_year = await repository.count_completed_reading_progress(
        member_id, since=year_start
    )
    completed_this_month = await repository.count_completed_reading_progress(
        member_id, since=month_start
    )

    return ReadingGoalOut.from_prisma(
        goal,
        completed_this_year=completed_this_year,
        completed_this_month=completed_this_month,
    )


async def get_reading_streak(member_id: str) -> ReadingStreakOut:
    rows = await repository.list_login_activity(member_id)
    login_dates = {row.date.date() for row in rows}
    current, longest = _compute_streaks(login_dates)
    return ReadingStreakOut(current_streak_days=current, longest_streak_days=longest)


def _compute_streaks(login_dates: set[date]) -> tuple[int, int]:
    if not login_dates:
        return 0, 0

    today = datetime.now(UTC).date()

    # Current streak counts backward from the most recent login day. If that's today or
    # yesterday the streak is still "alive" (grace period for not having logged in yet
    # today); anything older than that means the streak is broken.
    cursor = today if today in login_dates else today - timedelta(days=1)
    current = 0
    while cursor in login_dates:
        current += 1
        cursor -= timedelta(days=1)

    longest = 0
    run = 0
    for day in sorted(login_dates):
        run = run + 1 if (day - timedelta(days=1)) in login_dates else 1
        longest = max(longest, run)

    return current, longest
