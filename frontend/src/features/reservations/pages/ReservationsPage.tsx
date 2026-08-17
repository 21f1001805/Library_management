import { SearchX, Ticket } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common';
import { Button, Dialog, EmptyState, SearchBar } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api';
import { type Reservation, useAuth } from '@/providers/AuthProvider';

import { ReservationCard } from '../components/ReservationCard';

export function ReservationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getMyReservations, cancelReservation } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getMyReservations().then(setReservations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancellingReservation = reservations.find((entry) => entry.id === cancellingId);

  const query = search.trim().toLowerCase();
  const filteredReservations = useMemo(
    () => reservations.filter((entry) => entry.book_title.toLowerCase().includes(query)),
    [reservations, query],
  );

  async function confirmCancel() {
    if (!cancellingReservation) return;
    try {
      await cancelReservation(cancellingReservation.id);
      setReservations((prev) => prev.filter((entry) => entry.id !== cancellingReservation.id));
      toast.success(t('reservations.cancelSuccessToast', { book: cancellingReservation.book_title }));
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.errors.generic')));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('reservations.pageTitle')} description={t('reservations.pageDescription')} />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder={t('reservations.search.placeholder')}
        label={t('reservations.search.ariaLabel')}
        aria-label={t('reservations.search.ariaLabel')}
        className="sm:max-w-sm"
      />

      <section aria-labelledby="current-reservations-heading" className="flex flex-col gap-3">
        <h2 id="current-reservations-heading" className="text-lg font-semibold text-foreground">
          {t('reservations.current.heading')}
        </h2>
        {reservations.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={t('reservations.current.emptyTitle')}
            description={t('reservations.current.emptyDescription')}
            action={
              <Button size="sm" onClick={() => navigate(ROUTES.BOOKS)}>
                {t('reservations.current.browseBooks')}
              </Button>
            }
          />
        ) : filteredReservations.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t('reservations.search.noResultsTitle')}
            description={t('reservations.search.noResultsDescription')}
            action={
              <Button size="sm" variant="outline" onClick={() => setSearch('')}>
                {t('reservations.search.clearSearch')}
              </Button>
            }
          />
        ) : (
          filteredReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onCancel={() => setCancellingId(reservation.id)}
            />
          ))
        )}
      </section>

      <Dialog
        open={cancellingReservation != null}
        onClose={() => setCancellingId(null)}
        title={t('reservations.cancelDialog.title')}
        description={
          cancellingReservation
            ? t('reservations.cancelDialog.description', { book: cancellingReservation.book_title })
            : undefined
        }
        confirmLabel={t('reservations.cancelDialog.confirmLabel')}
        confirmVariant="danger"
        onConfirm={confirmCancel}
      />
    </div>
  );
}
