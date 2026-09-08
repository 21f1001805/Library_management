import type { CommunityBan, CommunityComment, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/community/repository.py.
const POST_INCLUDE = {
  author: true,
  likes: true,
  saves: true,
  reports: true,
  comments: { include: { author: true, reports: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CommunityPostInclude;

export type CommunityPostWithRelations = Prisma.CommunityPostGetPayload<{ include: typeof POST_INCLUDE }>;

function requiredPost(post: CommunityPostWithRelations | null): CommunityPostWithRelations {
  if (!post) throw new Error('Community post disappeared after a successful database write');
  return post;
}

export async function listPosts(opts: {
  page: number;
  pageSize: number;
}): Promise<[CommunityPostWithRelations[], number]> {
  const total = await prisma.communityPost.count({ where: { deletedAt: null } });
  const items = await prisma.communityPost.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
    include: POST_INCLUDE,
  });
  return [items, total];
}

export async function findPost(postId: string): Promise<CommunityPostWithRelations | null> {
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, include: POST_INCLUDE });
  if (!post || post.deletedAt !== null) return null;
  return post;
}

export async function createPost(
  authorId: string,
  data: { bookTitle: string | null; content: string; images: string[]; reported: boolean },
): Promise<CommunityPostWithRelations> {
  const created = await prisma.communityPost.create({ data: { ...data, authorId } });
  return requiredPost(await findPost(created.id));
}

export async function updatePost(
  postId: string,
  data: Partial<{
    bookTitle: string | null;
    content: string;
    images: string[];
    reported: boolean;
  }>,
): Promise<CommunityPostWithRelations> {
  await prisma.communityPost.update({ where: { id: postId }, data });
  return requiredPost(await findPost(postId));
}

export async function softDeletePost(postId: string): Promise<void> {
  await prisma.communityPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });
}

export async function setPostReported(
  postId: string,
  userId: string,
): Promise<CommunityPostWithRelations> {
  const existing = await prisma.communityPostReport.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (!existing) {
    await prisma.communityPostReport.create({ data: { postId, userId } });
  }
  return updatePost(postId, { reported: true });
}

export async function toggleLike(postId: string, userId: string): Promise<CommunityPostWithRelations> {
  const existing = await prisma.communityPostLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (existing) {
    await prisma.communityPostLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityPostLike.create({ data: { postId, userId } });
  }
  return requiredPost(await findPost(postId));
}

export async function toggleSave(postId: string, userId: string): Promise<CommunityPostWithRelations> {
  const existing = await prisma.communityPostSave.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (existing) {
    await prisma.communityPostSave.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityPostSave.create({ data: { postId, userId } });
  }
  return requiredPost(await findPost(postId));
}

export async function addComment(opts: {
  postId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  reported: boolean;
}): Promise<CommunityPostWithRelations> {
  await prisma.communityComment.create({
    data: {
      postId: opts.postId,
      authorId: opts.authorId,
      content: opts.content,
      parentId: opts.parentId,
      reported: opts.reported,
    },
  });
  return requiredPost(await findPost(opts.postId));
}

export async function findComment(commentId: string): Promise<CommunityComment | null> {
  return prisma.communityComment.findUnique({ where: { id: commentId } });
}

export async function deleteComment(commentId: string): Promise<void> {
  await prisma.communityComment.delete({ where: { id: commentId } });
}

export async function setCommentReported(commentId: string, userId: string): Promise<void> {
  const existing = await prisma.communityCommentReport.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });
  if (!existing) {
    await prisma.communityCommentReport.create({ data: { commentId, userId } });
  }
  await prisma.communityComment.update({ where: { id: commentId }, data: { reported: true } });
}

export async function findBan(userId: string): Promise<CommunityBan | null> {
  return prisma.communityBan.findUnique({ where: { userId } });
}

export async function listBans() {
  return prisma.communityBan.findMany({ include: { user: true }, orderBy: { createdAt: 'asc' } });
}

export async function banUser(userId: string): Promise<void> {
  await prisma.communityBan.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function unbanUser(userId: string): Promise<void> {
  const ban = await prisma.communityBan.findUnique({ where: { userId } });
  if (ban) await prisma.communityBan.delete({ where: { id: ban.id } });
}
