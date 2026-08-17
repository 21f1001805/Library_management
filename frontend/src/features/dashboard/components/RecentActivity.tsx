import { Bell, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconBadge } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { DashboardEvent } from '@/mocks/dashboard';
import type { AppNotificationRecord } from '@/providers/AuthProvider';

export function RecentNotifications({
  notifications,
}: {
  notifications: AppNotificationRecord[];
}) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={Bell} size={9} />
        <CardTitle>{t('dashboard.notifications.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('notifications.empty.title')}
            description={t('notifications.empty.description')}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="rounded-xl border border-border-muted bg-secondary/10 p-3 text-sm transition-colors hover:border-primary/20"
              >
                <p className="text-foreground">{notification.message}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {formatRelativeTime(notification.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function UpcomingEvents({ events }: { events: DashboardEvent[] }) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={CalendarDays} size={9} />
        <CardTitle>{t('dashboard.upcomingEvents.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t('dashboard.upcomingEvents.emptyTitle')}
            description={t('dashboard.upcomingEvents.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-muted bg-secondary/10 p-3 text-sm transition-colors hover:border-primary/20"
              >
                <span className="font-medium text-foreground">{event.title}</span>
                <span className="shrink-0 text-muted-foreground">{event.date}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
