from app.modules.leaderboard import repository
from app.modules.leaderboard.schemas import LeaderboardEntryOut

LEADERBOARD_LIMIT = 50


async def get_leaderboard(current_user_id: str) -> list[LeaderboardEntryOut]:
    counts = await repository.list_completed_counts(LEADERBOARD_LIMIT)
    names = await repository.list_member_names([member_id for member_id, _ in counts])

    return [
        LeaderboardEntryOut(
            rank=rank,
            member_id=member_id,
            full_name=names.get(member_id, ""),
            books_completed=count,
            is_current_user=member_id == current_user_id,
        )
        for rank, (member_id, count) in enumerate(counts, start=1)
    ]
