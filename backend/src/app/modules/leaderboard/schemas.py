from pydantic import BaseModel


class LeaderboardEntryOut(BaseModel):
    rank: int
    member_id: str
    full_name: str
    books_completed: int
    is_current_user: bool
