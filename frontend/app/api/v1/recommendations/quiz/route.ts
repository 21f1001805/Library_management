import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { quizAnswersSchema } from '@/server/recommendations/schemas';
import * as recommendationsService from '@/server/recommendations/service';

// Mirrors backend/src/app/modules/recommendations/router.py.

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.MEMBER);
  const quiz = await recommendationsService.buildQuiz();
  return NextResponse.json(quiz);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.MEMBER);
  const payload = quizAnswersSchema.parse(await readJsonBody(request));
  const result = await recommendationsService.submitQuiz(user.id, payload);
  return NextResponse.json(result);
});
