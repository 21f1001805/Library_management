// Mirrors backend/src/app/modules/leaderboard/schemas.py.
export interface LeaderboardEntryOut {
  rank: number;
  member_id: string;
  full_name: string;
  avatar_url: string | null;
  score: number;
  books_completed: number;
  reviews_count: number;
  reading_streak: number;
  badges: string[];
  is_current_user: boolean;
}
