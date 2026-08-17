import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Modal } from '@/components/ui';

const MAX_LENGTH = 1000;

export interface ResolveTicketModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (resolutionNote: string) => Promise<void>;
}

export function ResolveTicketModal({ open, onClose, onSubmit }: ResolveTicketModalProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setNote('');
  }

  async function handleSubmit() {
    if (note.trim().length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(note.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('support.staff.resolveModalTitle')}>
      <div className="flex flex-col gap-3">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={5}
          maxLength={MAX_LENGTH}
          placeholder={t('support.staff.resolutionPlaceholder')}
          autoFocus
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <p className="text-xs text-muted-foreground">{t('support.staff.resolutionHint')}</p>
        <Button disabled={note.trim().length === 0} isLoading={submitting} onClick={handleSubmit}>
          {t('support.staff.submitResolution')}
        </Button>
      </div>
    </Modal>
  );
}
