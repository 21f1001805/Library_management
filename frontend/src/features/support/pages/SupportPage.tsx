import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type SupportTicketRecord, type SupportTicketStatus } from '@/providers/AuthProvider';

import { GUARDIAN_CATEGORIES, MEMBER_CATEGORIES } from '../constants';
import { MyTicketsList } from '../components/MyTicketsList';
import { RaiseTicketModal } from '../components/RaiseTicketModal';
import { StaffTicketQueue } from '../components/StaffTicketQueue';

const STAFF_FILTERS: (SupportTicketStatus | 'all')[] = ['all', 'open', 'resolved', 'closed'];

function RaiserView({ role }: { role: 'member' | 'guardian' }) {
  const { t } = useTranslation();
  const { getMySupportTickets, confirmSupportTicket, reopenSupportTicket } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  function refresh() {
    getMySupportTickets().then(setTickets).catch(() => setTickets([]));
  }

  useEffect(refresh, [getMySupportTickets]);

  async function handleConfirm(ticketId: string) {
    try {
      await confirmSupportTicket(ticketId);
      toast.success(t('support.toasts.confirmed'));
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    }
  }

  async function handleReopen(ticketId: string) {
    try {
      await reopenSupportTicket(ticketId);
      toast.success(t('support.toasts.reopened'));
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('support.pageTitle')}
        description={t('support.pageDescription')}
        actions={<Button onClick={() => setModalOpen(true)}>{t('support.raiseButton')}</Button>}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">{t('support.history.title')}</h2>
        <MyTicketsList tickets={tickets} onConfirm={handleConfirm} onReopen={handleReopen} />
      </div>

      <RaiseTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={role === 'guardian' ? GUARDIAN_CATEGORIES : MEMBER_CATEGORIES}
        onCreated={() => {
          toast.success(t('support.toasts.created'));
          refresh();
        }}
      />
    </div>
  );
}

function StaffView() {
  const { t } = useTranslation();
  const { getStaffSupportTickets, resolveSupportTicket } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [filter, setFilter] = useState<(typeof STAFF_FILTERS)[number]>('open');

  function refresh() {
    getStaffSupportTickets(filter === 'all' ? undefined : filter)
      .then(setTickets)
      .catch(() => setTickets([]));
  }

  useEffect(refresh, [getStaffSupportTickets, filter]);

  async function handleResolve(ticketId: string, resolutionNote: string) {
    try {
      await resolveSupportTicket(ticketId, { resolution_note: resolutionNote });
      toast.success(t('support.staff.resolvedToast'));
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('support.staff.title')} description={t('support.staff.description')} />

      <div className="flex gap-2" role="group" aria-label={t('support.staff.filterAriaLabel')}>
        {STAFF_FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'primary' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {t(`support.staff.filters.${value}`)}
          </Button>
        ))}
      </div>

      <StaffTicketQueue tickets={tickets} onResolve={handleResolve} />
    </div>
  );
}

export function SupportPage() {
  const { role } = useAuth();

  if (role === 'admin' || role === 'manager' || role === 'it-head') {
    return <StaffView />;
  }
  if (role === 'guardian') {
    return <RaiserView role="guardian" />;
  }
  return <RaiserView role="member" />;
}
