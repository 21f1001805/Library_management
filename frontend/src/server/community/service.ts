import { HttpError } from '@/server/http';
import type { AuthenticatedUser } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { containsHarmfulContent } from '@/server/chat/guardrails';
import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as notificationsService from '@/server/notifications/service';
import * as repository from '@/server/community/repository';
import type { CommunityPostWithRelations } from '@/server/community/repository';
import {
  postToJson,
  type BannedAuthorOut,
  type CommentCreateInput,
  type PostCreateInput,
  type PostListResponse,
  type PostOut,
} from '@/server/community/schemas';

// Mirrors backend/src/app/modules/community/service.py.
const STAFF_ROLES = new Set<string>([Role.ADMIN, Role.MANAGER, Role.LIBRARIAN, Role.IT_HEAD]);
const MODERATOR_ROLES = new Set<string>([Role.ADMIN, Role.IT_HEAD]);
const REPORTER_ROLES = new Set<string>([Role.MEMBER, Role.MANAGER]);

async function notifyModerators(message: string): Promise<void> {
  await notificationsService.notifyRoles([...MODERATOR_ROLES], 'reported-comment', message);
}

async function ensureNotBanned(user: AuthenticatedUser): Promise<void> {
  if (await repository.findBan(user.id)) {
    throw new HttpError(403, 'You are banned from Community');
  }
}

async function getPostOr404(postId: string): Promise<CommunityPostWithRelations> {
  const post = await repository.findPost(postId);
  if (!post) throw new HttpError(404, 'Post not found');
  return post;
}

function postData(payload: PostCreateInput) {
  return { bookTitle: payload.book_title ?? null, content: payload.content, images: payload.images };
}

export async function listPosts(
  user: AuthenticatedUser,
  opts: { page: number; pageSize: number },
): Promise<PostListResponse> {
  const [posts, total] = await repository.listPosts(opts);
  return {
    items: posts.map((post) => postToJson(post, user.id)),
    total,
    page: opts.page,
    page_size: opts.pageSize,
  };
}

export async function createPost(
  user: AuthenticatedUser,
  payload: PostCreateInput,
): Promise<PostOut> {
  if (STAFF_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'Staff accounts cannot create posts');
  }
  await ensureNotBanned(user);
  // Auto-flag before a member ever has to report it — nothing is blocked or deleted,
  // this just puts the post straight into the same queue a member report would.
  const flagged = containsHarmfulContent(payload.content);
  const post = await repository.createPost(user.id, { ...postData(payload), reported: flagged });
  if (flagged) {
    await notifyModerators(`A new post by ${user.fullName} was automatically flagged for review.`);
  }
  return postToJson(post, user.id);
}

export async function updatePost(
  user: AuthenticatedUser,
  postId: string,
  payload: PostCreateInput,
): Promise<PostOut> {
  const post = await getPostOr404(postId);
  await ensureNotBanned(user);
  if (post.authorId !== user.id) {
    throw new HttpError(403, 'You can only edit your own posts');
  }
  const updated = await repository.updatePost(postId, postData(payload));
  return postToJson(updated, user.id);
}

export async function deletePost(user: AuthenticatedUser, postId: string): Promise<void> {
  const post = await getPostOr404(postId);
  if (post.authorId !== user.id && !MODERATOR_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'You cannot delete this post');
  }
  await repository.softDeletePost(postId);
}

export async function toggleLike(user: AuthenticatedUser, postId: string): Promise<PostOut> {
  const existing = await getPostOr404(postId);
  const wasLiked = existing.likes.some((like) => like.userId === user.id);
  const post = await repository.toggleLike(postId, user.id);
  if (!wasLiked && post.authorId !== user.id) {
    await notificationsService.createNotification(
      post.authorId,
      'post-like',
      `${user.fullName} liked your post.`,
    );
  }
  return postToJson(post, user.id);
}

export async function toggleSave(user: AuthenticatedUser, postId: string): Promise<PostOut> {
  await getPostOr404(postId);
  const post = await repository.toggleSave(postId, user.id);
  return postToJson(post, user.id);
}

export async function reportPost(user: AuthenticatedUser, postId: string): Promise<PostOut> {
  const post = await getPostOr404(postId);
  await ensureNotBanned(user);
  if (!REPORTER_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'You cannot report posts');
  }
  if (post.authorId === user.id) {
    throw new HttpError(400, 'You cannot report your own post');
  }
  const updated = await repository.setPostReported(postId, user.id);
  await notifyModerators(`${user.fullName} reported a post by ${post.author.fullName}.`);
  return postToJson(updated, user.id);
}

export async function addComment(
  user: AuthenticatedUser,
  postId: string,
  payload: CommentCreateInput,
): Promise<PostOut> {
  await getPostOr404(postId);
  await ensureNotBanned(user);

  let parent = null;
  if (payload.parent_id) {
    parent = await repository.findComment(payload.parent_id);
    if (!parent || parent.postId !== postId) {
      throw new HttpError(404, 'Comment not found');
    }
  }

  const flagged = containsHarmfulContent(payload.content);
  const post = await repository.addComment({
    postId,
    authorId: user.id,
    content: payload.content,
    parentId: payload.parent_id ?? null,
    reported: flagged,
  });
  if (flagged) {
    await notifyModerators(`A new comment by ${user.fullName} was automatically flagged for review.`);
  }

  if (parent !== null) {
    if (parent.authorId !== user.id) {
      await notificationsService.createNotification(
        parent.authorId,
        'post-comment',
        `${user.fullName} replied to your comment.`,
      );
    }
  } else if (post.authorId !== user.id) {
    await notificationsService.createNotification(
      post.authorId,
      'post-comment',
      `${user.fullName} commented on your post.`,
    );
  }

  return postToJson(post, user.id);
}

export async function deleteComment(user: AuthenticatedUser, commentId: string): Promise<void> {
  const comment = await repository.findComment(commentId);
  if (!comment) throw new HttpError(404, 'Comment not found');
  if (!STAFF_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'You cannot delete this comment');
  }
  await repository.deleteComment(commentId);
}

export async function reportComment(user: AuthenticatedUser, commentId: string): Promise<void> {
  await ensureNotBanned(user);
  const comment = await repository.findComment(commentId);
  if (!comment) throw new HttpError(404, 'Comment not found');
  if (!REPORTER_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'You cannot report comments');
  }
  if (comment.authorId === user.id) {
    throw new HttpError(400, 'You cannot report your own comment');
  }
  await repository.setCommentReported(commentId, user.id);
  await notifyModerators(`${user.fullName} reported a comment.`);
}

export async function listBannedAuthors(user: AuthenticatedUser): Promise<BannedAuthorOut[]> {
  if (!MODERATOR_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'You cannot view banned authors');
  }
  const bans = await repository.listBans();
  return bans.map((ban) => ({ user_id: ban.userId, full_name: ban.user.fullName }));
}

export async function banAuthor(user: AuthenticatedUser, targetUserId: string): Promise<void> {
  if (!MODERATOR_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'You cannot ban authors');
  }
  if (targetUserId === user.id) {
    throw new HttpError(400, 'You cannot ban yourself');
  }
  await repository.banUser(targetUserId);
  await auditLogService.record({
    actorId: user.id,
    action: AuditAction.COMMUNITY_USER_BANNED,
    metadata: { targetUserId },
  });
}

export async function unbanAuthor(user: AuthenticatedUser, targetUserId: string): Promise<void> {
  if (!MODERATOR_ROLES.has(user.role.name)) {
    throw new HttpError(403, 'You cannot unban authors');
  }
  await repository.unbanUser(targetUserId);
  await auditLogService.record({
    actorId: user.id,
    action: AuditAction.COMMUNITY_USER_UNBANNED,
    metadata: { targetUserId },
  });
}
