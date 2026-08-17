import { useTranslation } from 'react-i18next';

import { NoResults } from '@/components/feedback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { useAuth, type AuditLogEntry } from '@/providers/AuthProvider';

function useActionText(entry: AuditLogEntry) {
  const { t } = useTranslation();
  const { action, params } = entry;
  const amount = formatCurrency(Number(params.amount));

  switch (action) {
    case 'expenseApproved':
      return t('admin.auditLog.actions.expenseApproved', {
        amount,
        category: t(`admin.budget.categories.${params.category}`),
      });
    case 'refundIssued':
      return t('admin.auditLog.actions.refundIssued', { amount, name: params.memberName });
    case 'refundRejected':
      return t('admin.auditLog.actions.refundRejected', { amount, name: params.memberName });
    case 'feeWaived':
      return t('admin.auditLog.actions.feeWaived', { amount, name: params.memberName });
    case 'feeWaiverRejected':
      return t('admin.auditLog.actions.feeWaiverRejected', { amount, name: params.memberName });
    case 'pricingPlanUpdated':
      return t('admin.auditLog.actions.pricingPlanUpdated', {
        plan: t(`pricing.durations.${params.planId}.label`),
        amount,
      });
    case 'announcementSent':
      return t('admin.auditLog.actions.announcementSent', { count: Number(params.recipientCount) });
    case 'couponGenerated':
      return t('admin.auditLog.actions.couponGenerated', {
        code: params.code,
        percent: params.discountPercent,
        maxUses: params.maxUses,
      });
    default:
      return null;
  }
}

function useActorText(entry: AuditLogEntry) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  if (userId === entry.actor_id) return t('common.you');
  return `${entry.actor_name} (${t(`auth.login.roles.${entry.actor_role}`)})`;
}

function AuditLogItem({ entry }: { entry: AuditLogEntry }) {
  const actionText = useActionText(entry);
  const actorText = useActorText(entry);

  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <p className="text-foreground">{actionText}</p>
      <p className="text-muted-foreground">
        {actorText} · {formatRelativeTime(entry.created_at)}
      </p>
    </li>
  );
}

export function AuditLog({ entries }: { entries: AuditLogEntry[] }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.auditLog.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <NoResults title={t('admin.auditLog.empty')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <AuditLogItem key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
