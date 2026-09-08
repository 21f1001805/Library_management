import { z } from 'zod';

import type { ReviewWithRelations } from '@/server/reviews/repository';

// Mirrors backend/src/app/modules/reviews/schemas.py.
export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
  images: z.array(z.string()).max(4).default([]),
});
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export const reviewUpdateSchema = reviewCreateSchema;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;

export interface ReviewOut {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar_url: string | null;
  rating: number;
  comment: string;
  images: string[];
  created_at: string;
  is_own: boolean;
}

export function reviewToJson(review: ReviewWithRelations, currentUserId: string): ReviewOut {
  return {
    id: review.id,
    book_id: review.bookId,
    book_title: review.book.title,
    book_author: review.book.author,
    reviewer_id: review.memberId,
    reviewer_name: review.member.fullName,
    reviewer_avatar_url: review.member.avatarUrl,
    rating: review.rating,
    comment: review.comment,
    images: review.images,
    created_at: review.createdAt.toISOString(),
    is_own: review.memberId === currentUserId,
  };
}

export interface RatingBreakdownEntry {
  stars: number;
  percent: number;
}

export interface BookReviewsOut {
  items: ReviewOut[];
  average_rating: number;
  total_reviews: number;
  breakdown: RatingBreakdownEntry[];
  review_digest: string | null;
}
