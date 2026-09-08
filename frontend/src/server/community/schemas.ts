import { z } from 'zod';

import type { CommunityPostWithRelations } from '@/server/community/repository';

// Mirrors backend/src/app/modules/community/schemas.py.
export const postCreateSchema = z.object({
  book_title: z.string().max(255).nullable().optional(),
  content: z.string().min(1).max(2000),
  images: z.array(z.string()).max(4).default([]),
});
export type PostCreateInput = z.infer<typeof postCreateSchema>;

export const commentCreateSchema = z.object({
  content: z.string().min(1).max(1000),
  parent_id: z.string().nullable().optional(),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

export interface CommentOut {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  created_at: string;
  reported: boolean;
  reported_by_me: boolean;
  replies: CommentOut[];
}

type CommentWithRelations = CommunityPostWithRelations['comments'][number];

function commentToJson(comment: CommentWithRelations, currentUserId: string | null): CommentOut {
  const reports = comment.reports ?? [];
  const reportedByMe = currentUserId ? reports.some((r) => r.userId === currentUserId) : false;
  const isReported = comment.reported || reports.length > 0;
  return {
    id: comment.id,
    author_id: comment.authorId,
    author_name: comment.author.fullName,
    author_avatar_url: comment.author.avatarUrl,
    content: comment.content,
    created_at: comment.createdAt.toISOString(),
    reported: isReported,
    reported_by_me: reportedByMe,
    replies: [],
  };
}

function buildCommentTree(
  comments: CommentWithRelations[],
  currentUserId: string | null,
): CommentOut[] {
  const byId = new Map(comments.map((comment) => [comment.id, commentToJson(comment, currentUserId)]));
  const roots: CommentOut[] = [];
  for (const comment of comments) {
    const node = byId.get(comment.id);
    if (!node) continue;
    const parent = comment.parentId ? byId.get(comment.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

export interface PostOut {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  book_title: string | null;
  content: string;
  images: string[];
  created_at: string;
  like_count: number;
  is_liked: boolean;
  is_saved: boolean;
  is_own: boolean;
  reported: boolean;
  reported_by_me: boolean;
  comments: CommentOut[];
}

export function postToJson(post: CommunityPostWithRelations, currentUserId: string): PostOut {
  const reportedByMe = post.reports.some((r) => r.userId === currentUserId);
  return {
    id: post.id,
    author_id: post.authorId,
    author_name: post.author.fullName,
    author_avatar_url: post.author.avatarUrl,
    book_title: post.bookTitle,
    content: post.content,
    images: post.images,
    created_at: post.createdAt.toISOString(),
    like_count: post.likes.length,
    is_liked: post.likes.some((like) => like.userId === currentUserId),
    is_saved: post.saves.some((save) => save.userId === currentUserId),
    is_own: post.authorId === currentUserId,
    reported: post.reported,
    reported_by_me: reportedByMe,
    comments: buildCommentTree(post.comments, currentUserId),
  };
}

export interface PostListResponse {
  items: PostOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface BannedAuthorOut {
  user_id: string;
  full_name: string;
}
