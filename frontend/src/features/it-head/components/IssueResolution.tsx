import { useTranslation } from 'react-i18next';

import { NoResults } from '@/components/feedback';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { SupportTicketCategory, SupportTicketRecord } from '@/providers/AuthProvider';

const categoryLabelKey: Record<SupportTicketCategory, string> = {
  book_reservation: 'itHead.issueResolution.categories.bookReservation',
  payment: 'itHead.issueResolution.categories.payment',
  seat_booking: 'itHead.issueResolution.categories.seatBooking',
  harassment: 'itHead.issueResolution.categories.harassment',
  offline_library: 'itHead.issueResolution.categories.offlineLibrary',
  attendance: 'itHead.issueResolution.categories.attendance',
  other: 'itHead.issueResolution.categories.other',
};

export interface IssueResolutionProps {
  tickets: SupportTicketRecord[];
  onResolveClick: (ticket: SupportTicketRecord) => void;
}

export function IssueResolution({ tickets, onResolveClick }: IssueResolutionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('itHead.issueResolution.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tickets.length === 0 ? (
          <NoResults title={t('itHead.issueResolution.empty')} />
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t(categoryLabelKey[ticket.category])}</Badge>
                <Badge variant={ticket.status === 'open' ? 'warning' : 'success'}>
                  {t(`itHead.issueResolution.status.${ticket.status}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(ticket.created_at)}
                </span>
              </div>
              <p className="mt-1 text-foreground">{ticket.description}</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('itHead.issueResolution.from', { name: ticket.raised_by_name })}
                </p>
                {ticket.status === 'open' && (
                  <Button size="sm" onClick={() => onResolveClick(ticket)}>
                    {t('itHead.issueResolution.resolve')}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
