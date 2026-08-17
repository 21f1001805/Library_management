import { Calendar, MapPin, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export interface EventCardProps {
  title: string;
  date: string;
  location: string;
  attendees: number;
  capacity: number;
  registered: boolean;
  onViewDetails: () => void;
}

export function EventCard({
  title,
  date,
  location,
  attendees,
  capacity,
  registered,
  onViewDetails,
}: EventCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Calendar className="size-4" /> {date}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4" /> {location}
          </span>
          <span className="flex items-center gap-2">
            <Users className="size-4" /> {t('events.details.attending', { attendees, capacity })}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          {registered ? (
            <Badge variant="success">{t('common.cards.event.registered')}</Badge>
          ) : (
            <Badge variant="outline">{t('common.cards.event.open')}</Badge>
          )}
          <Button size="sm" variant="outline" onClick={onViewDetails}>
            {t('common.cards.event.viewDetails')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
