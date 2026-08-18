import { useTranslation } from 'react-i18next';

import { Badge, type BadgeVariant, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import type { Child } from '@/mocks/guardian';

const statusBadgeVariant: Record<Child['presenceStatus'], BadgeVariant> = {
  'in-library': 'success',
  left: 'outline',
};

export function ChildrenPresence({ children }: { children: Child[] }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('guardian.presence.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {children.length === 0 ? (
          <EmptyState
            title={t('guardian.presence.emptyTitle')}
            description={t('guardian.presence.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{child.name}</p>
                  <p className="text-muted-foreground">
                    {child.presenceStatus === 'in-library'
                      ? t('guardian.presence.checkedInAt', { time: child.presenceTime })
                      : t('guardian.presence.leftAt', { time: child.presenceTime })}
                  </p>
                </div>
                <Badge variant={statusBadgeVariant[child.presenceStatus]}>
                  {t(`guardian.presence.status.${child.presenceStatus === 'in-library' ? 'inLibrary' : 'left'}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
