import { computeStreaks } from '@/server/members/service';
import * as repository from '@/server/leaderboard/repository';
import type { LeaderboardEntryOut } from '@/server/leaderboard/schemas';

// Mirrors backend/src/app/modules/leaderboard/service.py. Note: the Python source
// declares LEADERBOARD_LIMIT = 50 but never actually applies it anywhere in
// get_leaderboard — every member is returned, unbounded. Replicated as-is (not
// "fixed") for behavioral parity; flagging it here rather than silently changing
// what the endpoint returns.

interface MemberStats {
  memberId: string;
  fullName: string;
  avatarUrl: string | null;
  score: number;
  booksCompleted: number;
  reviewsCount: number;
  eventsAttended: number;
  onTimeReturns: number;
  readingStreak: number;
  isCurrentUser: boolean;
}

// Ranks members by activity score. Every count is aggregated in SQL and the six
// queries run concurrently.
export async function getLeaderboard(currentUserId: string): Promise<LeaderboardEntryOut[]> {
  const [members, completedCounts, reviewCounts, eventCounts, [onTimeReturns, lateReturns], loginDatesPerMember] =
    await Promise.all([
      repository.listMemberUsers(),
      repository.countCompletedProgressByMember(),
      repository.countReviewsByMember(),
      repository.countAttendedEventsByMember(),
      repository.countReturnsByMember(),
      repository.listRecentLoginDates(),
    ]);
  if (members.length === 0) return [];

  const memberStats: MemberStats[] = members.map((m) => {
    const booksCompleted = completedCounts.get(m.id) ?? 0;
    const reviewsCount = reviewCounts.get(m.id) ?? 0;
    const eventsAttended = eventCounts.get(m.id) ?? 0;
    const onTimeCount = onTimeReturns.get(m.id) ?? 0;
    const lateCount = lateReturns.get(m.id) ?? 0;
    const [currentStreak] = computeStreaks(loginDatesPerMember.get(m.id) ?? new Set());

    // Scoring: complete a book +100, write a review +25, event +30, on-time return
    // +15, late return -10, 7-day streak +50.
    const score =
      booksCompleted * 100 +
      reviewsCount * 25 +
      eventsAttended * 30 +
      onTimeCount * 15 -
      lateCount * 10 +
      (currentStreak >= 7 ? 50 : 0);

    return {
      memberId: m.id,
      fullName: m.fullName,
      avatarUrl: m.avatarUrl,
      score,
      booksCompleted,
      reviewsCount,
      eventsAttended,
      onTimeReturns: onTimeCount,
      readingStreak: currentStreak,
      isCurrentUser: m.id === currentUserId,
    };
  });

  // Tie-breaking hierarchy: score desc, books completed desc, reviews desc, streak
  // desc, full name A-Z.
  memberStats.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.booksCompleted !== b.booksCompleted) return b.booksCompleted - a.booksCompleted;
    if (a.reviewsCount !== b.reviewsCount) return b.reviewsCount - a.reviewsCount;
    if (a.readingStreak !== b.readingStreak) return b.readingStreak - a.readingStreak;
    // Plain ordinal comparison (not localeCompare) to match Python's str.lower() < ...
    // comparison exactly rather than applying locale-aware collation.
    const aName = a.fullName.toLowerCase();
    const bName = b.fullName.toLowerCase();
    return aName < bName ? -1 : aName > bName ? 1 : 0;
  });

  // Rank across everyone. "reading_champion" depends on rank 1.
  return memberStats.map((stats, index) => {
    const rank = index + 1;
    const badges: string[] = [];
    if (stats.booksCompleted >= 10) badges.push('bookworm');
    if (stats.readingStreak >= 7) badges.push('7_day_streak');
    if (stats.reviewsCount >= 10) badges.push('top_reviewer');
    if (stats.onTimeReturns >= 10) badges.push('perfect_returner');
    if (rank === 1) badges.push('reading_champion');
    if (stats.eventsAttended >= 5) badges.push('community_star');

    return {
      rank,
      member_id: stats.memberId,
      full_name: stats.fullName,
      avatar_url: stats.avatarUrl,
      score: stats.score,
      books_completed: stats.booksCompleted,
      reviews_count: stats.reviewsCount,
      reading_streak: stats.readingStreak,
      badges,
      is_current_user: stats.isCurrentUser,
    };
  });
}
