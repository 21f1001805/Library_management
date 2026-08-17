import { useTranslation } from 'react-i18next';

export function SeatLegend() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-sm bg-success" /> {t('landing.seatAvailability.available')}
      </span>
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-sm bg-warning" /> {t('landing.seatAvailability.reserved')}
      </span>
    </div>
  );
}
