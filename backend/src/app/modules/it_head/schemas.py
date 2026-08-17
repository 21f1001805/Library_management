from datetime import datetime

from pydantic import BaseModel


class ITHeadStatsOut(BaseModel):
    active_members: int
    open_issues: int
    pending_permissions: int
    fees_outstanding: int
    late_fines_outstanding: int


class FeeStatusEntryOut(BaseModel):
    member_id: str
    member_name: str
    amount_due: int
    status: str  # paid | due | overdue
    due_date: datetime | None


class ITHeadDashboardOut(BaseModel):
    stats: ITHeadStatsOut
    fee_status: list[FeeStatusEntryOut]
