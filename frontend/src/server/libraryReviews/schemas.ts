import { z } from 'zod';

import type { LibraryReviewWithMember } from '@/server/libraryReviews/repository';

// Mirrors backend/src/app/modules/library_reviews/schemas.py.
export const libraryReviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(500),
});
export type LibraryReviewCreateInput = z.infer<typeof libraryReviewCreateSchema>;

export interface LibraryReviewOut {
  id: string;
  rating: number;
  comment: string;
  status: string;
  member_id: string;
  member_name: string;
  member_role: string;
  created_at: string;
}

export function libraryReviewToJson(row: LibraryReviewWithMember): LibraryReviewOut {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    member_id: row.memberId,
    member_name: row.member.fullName,
    member_role: row.member.role.name,
    created_at: row.createdAt.toISOString(),
  };
}
