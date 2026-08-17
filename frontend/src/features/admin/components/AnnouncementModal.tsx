import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button, Modal } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

const announcementSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { message: 'Enter a message' })
    .max(500, { message: 'Keep it under 500 characters' }),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export interface AnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function AnnouncementModal({ open, onClose, onSent }: AnnouncementModalProps) {
  const { t } = useTranslation();
  const { sendAnnouncement } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    values: { message: '' },
  });

  async function onSubmit(values: AnnouncementFormValues) {
    try {
      const result = await sendAnnouncement({ message: values.message });
      toast.success(t('admin.announcement.successToast', { count: result.recipient_count }));
      reset();
      onSent();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('admin.announcement.title')}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <p className="text-sm text-muted-foreground">{t('admin.announcement.description')}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="announcement-message" className="text-sm font-medium text-foreground">
            {t('admin.announcement.messageLabel')}
          </label>
          <textarea
            id="announcement-message"
            rows={4}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            {...register('message')}
          />
          {errors.message?.message && <p className="text-sm text-danger">{errors.message.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {t('admin.announcement.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
