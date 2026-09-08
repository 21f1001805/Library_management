import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/server/http';
import { getCurrentUser } from '@/server/auth/guards';
import * as leaderboardService from '@/server/leaderboard/service';

export const GET = withErrorHandling(async (request) => {
  const user = await getCurrentUser(request);
  const leaderboard = await leaderboardService.getLeaderboard(user.id);
  return NextResponse.json(leaderboard);
});
