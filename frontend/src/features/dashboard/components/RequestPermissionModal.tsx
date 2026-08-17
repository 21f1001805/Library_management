import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button, Input, Modal } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

const requestPermissionSchema = z.object({
  permission: z.string().trim().min(1, { message: 'Enter what you need permission for' }),
  reason: z.string().trim().min(1, { message: 'Enter a reason' }),
});

type RequestPermissionFormValues = z.infer<typeof requestPermissionSchema>;

export interface RequestPermissionModalProps {
  open: boolean;
  onClose: () => void;
}

export function RequestPermissionModal({ open, onClose }: RequestPermissionModalProps) {
  const { t } = useTranslation();
  const { createPermissionRequest } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestPermissionFormValues>({
    resolver: zodResolver(requestPermissionSchema),
    values: { permission: '', reason: '' },
  });

  async function onSubmit(values: RequestPermissionFormValues) {
    try {
      await createPermissionRequest(values);
      toast.success(t('managerDashboard.requestPermission.successToast'));
      reset();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('managerDashboard.requestPermission.title')}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label={t('managerDashboard.requestPermission.permissionLabel')}
          placeholder={t('managerDashboard.requestPermission.permissionPlaceholder')}
          error={errors.permission?.message}
          {...register('permission')}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="permission-reason" className="text-sm font-medium text-foreground">
            {t('managerDashboard.requestPermission.reasonLabel')}
          </label>
          <textarea
            id="permission-reason"
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            {...register('reason')}
          />
          {errors.reason?.message && <p className="text-sm text-danger">{errors.reason.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {t('managerDashboard.requestPermission.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
