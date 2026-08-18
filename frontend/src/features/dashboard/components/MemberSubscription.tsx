import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button, Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui';
import { ROUTES } from '@/constants/routes';

export interface MemberSubscriptionProps {
  planLabel: string;
  /** No active plan yet (first-time member) when omitted. */
  expiresOn?: string;
  outstandingFine: string;
  fineReasonKey?: string;
  fineBookTitle?: string;
  fineDueDate?: string;
  fineDailyPenalty?: string;
  fineEscalatedAmount?: string;
}

// Mirrors the guardian's SubscriptionAndFines card, but for the signed-in
// member's own plan. Renew goes straight to Payment for the existing plan
// (Payment offers a "Change Plan" link back to Pricing for anyone who wants
// a different one); with no active plan yet there's nothing to renew, so
// that case still goes to Pricing to pick a first plan.
export function MemberSubscription({
  planLabel,
  expiresOn,
  outstandingFine,
  fineReasonKey,
  fineBookTitle,
  fineDueDate,
  fineDailyPenalty,
  fineEscalatedAmount,
}: MemberSubscriptionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showFineDetails, setShowFineDetails] = useState(false);
  const hasFine = outstandingFine !== '₹0';

  function payFine() {
    const amount = Number(outstandingFine.replace(/[^\d.]/g, ''));
    navigate(
      `${ROUTES.PAYMENT}?amount=${amount}&label=${encodeURIComponent(t('dashboard.subscription.fineOwed', { amount: outstandingFine }))}`,
    );
  }

  function renewOrViewPlans() {
    if (!expiresOn) {
      navigate(ROUTES.PRICING);
      return;
    }
    const label = t('dashboard.subscription.renewalPaymentLabel', { plan: planLabel });
    // Renewal always renews at the 1-month plan/price, regardless of the member's
    // original plan length — same simplification as before, now sourced from the
    // backend plan by id instead of a hardcoded price constant.
    navigate(`${ROUTES.PAYMENT}?plan=1m&label=${encodeURIComponent(label)}&renewal=1`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.subscription.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{planLabel}</p>
          <p className="text-muted-foreground">
            {expiresOn
              ? t('dashboard.subscription.expiresOn', { date: expiresOn })
              : t('dashboard.subscription.noPlan')}
          </p>
          <p className={hasFine ? 'text-danger' : 'text-muted-foreground'}>
            {hasFine
              ? t('dashboard.subscription.fineOwed', { amount: outstandingFine })
              : t('dashboard.subscription.noFine')}
            {hasFine && (
              <button
                type="button"
                onClick={() => setShowFineDetails(true)}
                className="ml-2 text-sm font-medium text-primary-gradient underline underline-offset-2 hover:no-underline"
              >
                {t('dashboard.subscription.viewFineDetails')}
              </button>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {hasFine && (
            <Button size="sm" variant="outline" onClick={payFine}>
              {t('dashboard.subscription.payFine')}
            </Button>
          )}
          <Button size="sm" onClick={renewOrViewPlans}>
            {expiresOn ? t('dashboard.subscription.renew') : t('dashboard.subscription.viewPlans')}
          </Button>
        </div>
      </CardContent>

      <Modal
        open={showFineDetails}
        onClose={() => setShowFineDetails(false)}
        title={t('dashboard.subscription.fineDetails.title')}
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('dashboard.subscription.fineDetails.reason')}</span>
            <span className="text-right font-medium text-foreground">
              {fineReasonKey ? t(`dashboard.subscription.fineDetails.reasons.${fineReasonKey}`) : '—'}
              {fineBookTitle ? ` — ${fineBookTitle}` : ''}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('dashboard.subscription.fineDetails.amountDue')}</span>
            <span className="font-semibold text-danger">{outstandingFine}</span>
          </div>
          {fineDueDate && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('dashboard.subscription.fineDetails.payBy')}</span>
              <span className="font-medium text-foreground">{fineDueDate}</span>
            </div>
          )}
          {fineDailyPenalty && fineEscalatedAmount && (
            <div className="rounded-md bg-danger/10 p-3 text-danger">
              {t('dashboard.subscription.fineDetails.escalationNotice', {
                daily: fineDailyPenalty,
                escalated: fineEscalatedAmount,
              })}
            </div>
          )}
          <Button size="sm" onClick={payFine}>
            {t('dashboard.subscription.payFine')}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
