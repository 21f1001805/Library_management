import { Bookmark, Flag, Heart, MessageCircle, Pencil, Send, Trash2, UserX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Badge, Card, CardContent, CardHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { CommunityPost, PostComment } from '@/providers/AuthProvider';
import { useAuth } from '@/providers/AuthProvider';

export interface PostCardProps {
  post: CommunityPost;
  onToggleLike: () => void;
  onToggleSave?: () => void;
  onAddComment: (content: string) => void;
  onAddReply: (commentId: string, content: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Staff-only: lets a reported comment be removed. */
  onDeleteComment?: (commentId: string) => void;
  /** IT Head-only: temporarily bans the post's author from Community. */
  onBan?: () => void;
  isBanned?: boolean;
  /** Member/Manager-only: flags this post for admin review. */
  onReportPost?: () => void;
  /** Member/Manager-only: flags a comment on this post for admin review. */
  onReportComment?: (commentId: string) => void;
}

function CommentRow({
  comment,
  depth = 0,
  currentUserId,
  onReply,
  onDeleteComment,
  onReportComment,
}: {
  comment: PostComment;
  depth?: number;
  currentUserId: string | null;
  onReply: (commentId: string, content: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onReportComment?: (commentId: string) => void;
}) {
  const { t } = useTranslation();
  const [isReplying, setIsReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');

  function handleReplySubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = replyDraft.trim();
    if (!content) return;
    onReply(comment.id, content);
    setReplyDraft('');
    setIsReplying(false);
  }

  return (
    <div className={cn('flex flex-col gap-2', depth > 0 && 'ml-8')}>
      <div className="flex gap-2">
        <Avatar src={comment.author_avatar_url ?? undefined} name={comment.author_name} size="sm" />
        <div className="flex-1">
          <div className="rounded-lg bg-secondary/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">{comment.author_name}</p>
              {comment.reported && (
                <Badge variant="danger">{t('community.post.reportedBadge')}</Badge>
              )}
            </div>
            <p className="text-sm text-foreground">{comment.content}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1">
            <button
              type="button"
              onClick={() => setIsReplying((open) => !open)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t('community.post.reply')}
            </button>
            {!comment.reported && comment.author_id !== currentUserId && onReportComment && (
              <button
                type="button"
                onClick={() => onReportComment(comment.id)}
                className="text-xs font-medium text-muted-foreground hover:text-danger"
              >
                {t('community.post.report')}
              </button>
            )}
            {comment.reported && onDeleteComment && (
              <button
                type="button"
                onClick={() => onDeleteComment(comment.id)}
                className="text-xs font-medium text-danger hover:underline"
              >
                {t('community.post.removeComment')}
              </button>
            )}
          </div>
        </div>
      </div>

      {isReplying && (
        <form onSubmit={handleReplySubmit} className="ml-10 flex items-center gap-2">
          <input
            value={replyDraft}
            onChange={(event) => setReplyDraft(event.target.value)}
            placeholder={t('community.post.replyPlaceholder')}
            aria-label={t('community.post.replyPlaceholder')}
            autoFocus
            className="h-8 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <button
            type="submit"
            disabled={replyDraft.trim().length === 0}
            aria-label={t('community.post.sendReply')}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="size-3.5" />
          </button>
        </form>
      )}

      {comment.replies.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          currentUserId={currentUserId}
          onReply={onReply}
          onDeleteComment={onDeleteComment}
          onReportComment={onReportComment}
        />
      ))}
    </div>
  );
}

export function PostCard({
  post,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onAddReply,
  onEdit,
  onDelete,
  onDeleteComment,
  onBan,
  isBanned,
  onReportPost,
  onReportComment,
}: PostCardProps) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  function handleAddComment(event: React.FormEvent) {
    event.preventDefault();
    const content = commentDraft.trim();
    if (!content) return;
    onAddComment(content);
    setCommentDraft('');
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <Avatar src={post.author_avatar_url ?? undefined} name={post.author_name} size="md" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{post.author_name}</p>
            {isBanned && <Badge variant="danger">{t('community.post.bannedBadge')}</Badge>}
            {post.reported && <Badge variant="danger">{t('community.post.reportedBadge')}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{formatRelativeTime(post.created_at)}</p>
        </div>
        {post.book_title && <Badge variant="outline">{post.book_title}</Badge>}
        {onReportPost && !post.reported && (
          <button
            type="button"
            onClick={onReportPost}
            aria-label={t('community.post.reportAria', { author: post.author_name })}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Flag className="size-4" />
          </button>
        )}
        {onBan && (
          <button
            type="button"
            onClick={onBan}
            aria-label={t('community.post.banAria', { author: post.author_name })}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <UserX className="size-4" />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('community.post.editAria')}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('community.post.deleteAria')}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-sm text-foreground">{post.content}</p>

        {post.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.images.map((src, index) => (
              <img
                key={index}
                src={src}
                alt=""
                className="size-24 rounded-md border border-border object-cover"
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 border-t border-border pt-2">
          <button
            type="button"
            onClick={onToggleLike}
            aria-pressed={post.is_liked}
            aria-label={t(post.is_liked ? 'community.post.unlikeAria' : 'community.post.likeAria')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary',
              post.is_liked ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            <Heart className={cn('size-4', post.is_liked && 'fill-danger')} />
            {post.like_count}
          </button>

          <button
            type="button"
            onClick={() => setIsCommentsOpen((open) => !open)}
            aria-expanded={isCommentsOpen}
            aria-label={t('community.post.commentAria')}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
          >
            <MessageCircle className="size-4" />
            {post.comments.length}
          </button>

          {onToggleSave && (
            <button
              type="button"
              onClick={onToggleSave}
              aria-pressed={post.is_saved}
              aria-label={t(post.is_saved ? 'community.post.unsaveAria' : 'community.post.saveAria')}
              className={cn(
                'ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary',
                post.is_saved ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Bookmark className={cn('size-4', post.is_saved && 'fill-primary')} />
            </button>
          )}
        </div>

        {isCommentsOpen && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            {post.comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                currentUserId={userId}
                onReply={onAddReply}
                onDeleteComment={onDeleteComment}
                onReportComment={onReportComment}
              />
            ))}

            <form onSubmit={handleAddComment} className="flex items-center gap-2">
              <input
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder={t('community.post.commentPlaceholder')}
                aria-label={t('community.post.commentPlaceholder')}
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <button
                type="submit"
                disabled={commentDraft.trim().length === 0}
                aria-label={t('community.post.sendComment')}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
