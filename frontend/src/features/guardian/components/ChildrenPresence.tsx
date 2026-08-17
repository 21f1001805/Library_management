import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconBadge } from '@/components/common';
import {
  Avatar,
  Badge,
  type BadgeVariant,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui';
import type { Child } from '@/mocks/guardian';

const statusBadgeVariant: Record<Child['presenceStatus'], BadgeVariant> = {
  'in-library': 'success',
  left: 'outline',
};

export function ChildrenPresence({ children }: { children: Child[] }) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={Users} size={9} />
        <CardTitle>{t('guardian.presence.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {children.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('guardian.presence.emptyTitle')}
            description={t('guardian.presence.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex flex-col gap-2 rounded-xl border border-border-muted bg-secondary/10 p-3.5 text-sm transition-colors hover:border-primary/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={child.name} size="sm" />
                  <div>
                    <p className="font-medium text-foreground">{child.name}</p>
                    <p className="text-muted-foreground">
                      {child.presenceStatus === 'in-library'
                        ? t('guardian.presence.checkedInAt', { time: child.presenceTime })
                        : t('guardian.presence.leftAt', { time: child.presenceTime })}
                    </p>
                  </div>
                </div>
                <Badge variant={statusBadgeVariant[child.presenceStatus]} className="shrink-0">
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
