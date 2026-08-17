import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { comingSoonToast } from '@/lib/comingSoonToast';
import type { WalkInRequest } from '@/mocks/manager';

export interface WalkInAssistanceProps {
  requests: WalkInRequest[];
}

// Front-desk queue: members who show up without an online seat/book
// reservation. The manager takes their email and completes it for them.
export function WalkInAssistance({ requests }: WalkInAssistanceProps) {
  const { t } = useTranslation();

  function handleAction(request: WalkInRequest) {
    const toastKey = request.type === 'seat' ? 'bookSeatToast' : 'issueBookToast';
    comingSoonToast(t(`managerDashboard.walkIns.${toastKey}`, { name: request.memberName }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('managerDashboard.walkIns.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            title={t('managerDashboard.walkIns.emptyTitle')}
            description={t('managerDashboard.walkIns.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {t(`managerDashboard.walkIns.${request.type === 'seat' ? 'seatBadge' : 'bookBadge'}`)}
                    </Badge>
                    <p className="text-sm font-medium text-foreground">{request.memberName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{request.memberEmail}</p>
                  <p className="text-xs text-muted-foreground">{request.detail}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('managerDashboard.walkIns.requestedAt', { time: request.requestedAt })}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleAction(request)}>
                  {t(`managerDashboard.walkIns.${request.type === 'seat' ? 'bookSeat' : 'issueBook'}`)}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
