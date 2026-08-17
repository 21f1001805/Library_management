from collections import Counter

from app.core.constants import Role
from app.db.prisma import prisma


# ponytail: counts in Python rather than a DB group_by — no other module in this
# codebase uses group_by yet, and the row count (completed reading entries) is small.
# Swap for prisma.readingprogress.group_by(...) if this table gets large.
async def list_completed_counts(limit: int) -> list[tuple[str, int]]:
    rows = await prisma.readingprogress.find_many(
        where={"status": "completed", "member": {"role": {"name": Role.MEMBER}}}
    )
    return Counter(row.memberId for row in rows).most_common(limit)


async def list_member_names(member_ids: list[str]) -> dict[str, str]:
    if not member_ids:
        return {}
    users = await prisma.user.find_many(where={"id": {"in": member_ids}})
    return {user.id: user.fullName for user in users}
