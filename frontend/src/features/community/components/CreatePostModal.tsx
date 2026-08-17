import { ImagePlus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Modal } from '@/components/ui';

export interface PostDraft {
  bookTitle: string;
  content: string;
  images: string[];
}

export interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: PostDraft) => void;
  /** When set, the modal opens pre-filled for editing an existing post. */
  initialValues?: PostDraft;
}

const MAX_IMAGES = 4;
const MAX_CONTENT_LENGTH = 500;

export function CreatePostModal({ open, onClose, onSubmit, initialValues }: CreatePostModalProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(initialValues);
  const [bookTitle, setBookTitle] = useState(initialValues?.bookTitle ?? '');
  const [content, setContent] = useState(initialValues?.content ?? '');
  const [images, setImages] = useState<string[]>(initialValues?.images ?? []);

  // Re-sync the draft whenever the modal transitions to open, so a fresh
  // "create" starts blank and "edit" starts pre-filled with that post.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBookTitle(initialValues?.bookTitle ?? '');
      setContent(initialValues?.content ?? '');
      setImages(initialValues?.images ?? []);
    }
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const remainingSlots = MAX_IMAGES - images.length;
    event.target.value = '';
    // Data URLs (not blob: URLs) because there's no upload/object storage yet
    // (see the ponytail note on CommunityPost.images) — this way the image
    // actually persists in the DB and is visible to other users/after reload.
    const nextUrls = await Promise.all(files.slice(0, remainingSlots).map(readAsDataUrl));
    setImages((prev) => [...prev, ...nextUrls]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (content.trim().length === 0) return;
    onSubmit({ bookTitle: bookTitle.trim(), content: content.trim(), images });
  }

  const canSubmit = content.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('community.createPostModal.editTitle') : t('community.createPostModal.title')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('community.createPostModal.bookTitleLabel')}
          placeholder={t('community.createPostModal.bookTitlePlaceholder')}
          value={bookTitle}
          onChange={(event) => setBookTitle(event.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="post-content" className="text-sm font-medium text-foreground">
            {t('community.createPostModal.contentLabel')}
          </label>
          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            maxLength={MAX_CONTENT_LENGTH}
            placeholder={t('community.createPostModal.contentPlaceholder')}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {content.length}/{MAX_CONTENT_LENGTH}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">{t('community.createPostModal.imagesLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {images.map((src, index) => (
              <div key={src} className="relative size-16 overflow-hidden rounded-md border border-border">
                <img src={src} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  aria-label={t('community.createPostModal.removeImage')}
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label
                htmlFor="post-images"
                className="flex size-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <ImagePlus className="size-5" />
                <span className="text-[10px]">{t('community.createPostModal.addImage')}</span>
                <input
                  id="post-images"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleImageSelect}
                />
              </label>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('community.createPostModal.imagesHint', { count: MAX_IMAGES })}
          </p>
        </div>

        <Button type="submit" disabled={!canSubmit}>
          {isEditing ? t('community.createPostModal.saveChanges') : t('community.createPostModal.submit')}
        </Button>
      </form>
    </Modal>
  );
}
