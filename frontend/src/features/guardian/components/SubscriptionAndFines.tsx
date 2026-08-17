import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { IconBadge } from '@/components/common';
import { Avatar, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Modal } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuth, type GuardianChild } from '@/providers/AuthProvider';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface SubscriptionAndFinesProps {
  children: GuardianChild[];
  onChanged: () => void;
}

export function SubscriptionAndFines({ children, onChanged }: SubscriptionAndFinesProps) {
  const { t } = useTranslation();
  const { payChildFines, renewChildSubscription } = useAuth();
  const [fineDetailsChildId, setFineDetailsChildId] = useState<string | null>(null);
  const [pendingChildId, setPendingChildId] = useState<string | null>(null);
  const fineDetailsChild = children.find((child) => child.id === fineDetailsChildId) ?? null;

  async function payFine(child: GuardianChild) {
    setPendingChildId(child.id);
    try {
      await payChildFines(child.id);
      toast.success(t('guardian.subscription.fineOwed', { amount: formatCurrency(child.outstanding_fine) }));
      setFineDetailsChildId(null);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setPendingChildId(null);
    }
  }

  async function renewChild(child: GuardianChild) {
    setPendingChildId(child.id);
    try {
      await renewChildSubscription(child.id);
      toast.success(t('guardian.subscription.renewToast', { name: child.full_name }));
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setPendingChildId(null);
    }
  }

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <IconBadge icon={Wallet} size={9} />
        <CardTitle>{t('guardian.subscription.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {children.length === 0 && (
          <EmptyState
            icon={Wallet}
            title={t('guardian.subscription.emptyTitle')}
            description={t('guardian.subscription.emptyDescription')}
          />
        )}
        {children.map((child) => {
          const hasFine = child.outstanding_fine > 0;
          const isPending = pendingChildId === child.id;
          return (
            <div
              key={child.id}
              className="flex flex-col gap-2 rounded-xl border border-border-muted bg-secondary/10 p-3.5 text-sm transition-colors hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={child.full_name} size="sm" />
                  <p className="font-medium text-foreground">{child.full_name}</p>
                </div>
                {hasFine && (
                  <button
                    type="button"
                    onClick={() => setFineDetailsChildId(child.id)}
                    className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t('guardian.subscription.viewFineDetails')}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-muted-foreground">
                    {child.subscription_expires_on
                      ? t('guardian.subscription.expiresOn', {
                          date: formatDate(child.subscription_expires_on),
                        })
                      : t('guardian.subscription.noSubscription')}
                  </p>
                  <p className={hasFine ? 'text-danger' : 'text-muted-foreground'}>
                    {hasFine
                      ? t('guardian.subscription.fineOwed', {
                          amount: formatCurrency(child.outstanding_fine),
                        })
                      : t('guardian.subscription.noFine')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {hasFine && (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={isPending}
                      onClick={() => payFine(child)}
                    >
                      {t('guardian.subscription.payFine')}
                    </Button>
                  )}
                  <Button size="sm" isLoading={isPending} onClick={() => renewChild(child)}>
                    {t('guardian.subscription.renew')}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Modal
        open={fineDetailsChild !== null}
        onClose={() => setFineDetailsChildId(null)}
        title={
          fineDetailsChild
            ? `${t('guardian.subscription.fineDetails.title')} — ${fineDetailsChild.full_name}`
            : t('guardian.subscription.fineDetails.title')
        }
      >
        {fineDetailsChild && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('guardian.subscription.fineDetails.reason')}</span>
              <span className="text-right font-medium text-foreground">
                {fineDetailsChild.fine_book_title
                  ? t('guardian.subscription.fineDetails.reasons.lateReturn')
                  : '—'}
                {fineDetailsChild.fine_book_title ? ` — ${fineDetailsChild.fine_book_title}` : ''}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('guardian.subscription.fineDetails.amountDue')}</span>
              <span className="font-semibold text-danger">
                {formatCurrency(fineDetailsChild.outstanding_fine)}
              </span>
            </div>
            {fineDetailsChild.fine_due_date && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('guardian.subscription.fineDetails.payBy')}</span>
                <span className="font-medium text-foreground">
                  {formatDate(fineDetailsChild.fine_due_date)}
                </span>
              </div>
            )}
            <Button
              size="sm"
              isLoading={pendingChildId === fineDetailsChild.id}
              onClick={() => payFine(fineDetailsChild)}
            >
              {t('guardian.subscription.payFine')}
            </Button>
          </div>
        )}
      </Modal>
    </Card>
  );
}
