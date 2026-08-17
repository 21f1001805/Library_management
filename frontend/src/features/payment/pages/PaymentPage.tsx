import { Banknote, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AnimatedNumber, PageHeader } from '@/components/common';
import { Badge, Button, Card, CardContent, Input, Loader } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type CouponValidation, type PricingPlan } from '@/providers/AuthProvider';

// Auth is already enforced by the ProtectedRoute this page is nested under
// (see AppRouter.tsx) — no need to re-check isAuthenticated here.
export function PaymentPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    createPayment,
    payAtLibrary,
    getPricingPlans,
    validateCoupon,
    postAuthRedirect,
    clearPostAuthRedirect,
  } = useAuth();

  // Set for membership-plan payments (Register, first-time Google signup, renewal) —
  // the real price/months come from the backend-seeded plan, not the URL, so the
  // amount can't be tampered with via the query string. Fine payments omit it and
  // fall back to a raw `amount` param instead, since fines have no plan behind them.
  const planId = params.get('plan');
  const rawAmount = Number(params.get('amount')) || 0;
  const label = params.get('label') ?? t('payment.defaultLabel');
  const isRenewal = params.get('renewal') === '1';

  const [plan, setPlan] = useState<PricingPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(Boolean(planId));

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    getPricingPlans()
      .then((plans) => {
        if (!cancelled) setPlan(plans.find((item) => item.plan_id === planId) ?? null);
      })
      .finally(() => !cancelled && setIsLoadingPlan(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const baseAmount = planId ? (plan?.price ?? 0) : rawAmount;
  const months = planId ? plan?.months : undefined;

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const amount = appliedCoupon
    ? Math.round((baseAmount * (100 - appliedCoupon.discount_percent)) / 100)
    : baseAmount;

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(couponCode.trim());
      setAppliedCoupon(result);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  }

  useEffect(() => {
    if (params.get('failed') === '1') {
      toast.error('Payment failed, try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume PublicRoute's post-registration redirect once we've actually landed here, so a
  // later browser-back to /login or /register while still authenticated doesn't bounce back
  // to Payment (see guards.tsx's PublicRoute for why this isn't cleared there instead).
  useEffect(() => {
    if (postAuthRedirect) clearPostAuthRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ponytail: real Razorpay Checkout.js + order-creation endpoint + signature
  // verification isn't built yet — these two buttons stand in for that gateway
  // callback so the rest of the app (payment recorded, redirect on success/failure)
  // can be built and tested now. Swap the bodies for a real Checkout.js call later.
  async function handleSimulateSuccess() {
    try {
      // The base (pre-discount) amount is sent — the backend re-validates the coupon
      // and applies the discount itself, so the discounted total is never client-trusted.
      await createPayment({
        amount: baseAmount,
        label,
        plan_months: months,
        coupon_code: appliedCoupon?.code,
      });
      toast.success('Payment successful');
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not record payment'));
    }
  }

  function handleSimulateFailure() {
    const planOrAmountParam = planId ? `plan=${planId}` : `amount=${baseAmount}`;
    navigate(
      `${ROUTES.PAYMENT}?${planOrAmountParam}&label=${encodeURIComponent(label)}&failed=1`,
      { replace: true },
    );
  }

  async function handlePayAtLibrary() {
    try {
      await payAtLibrary({ amount: baseAmount, label });
      toast.success(t('payment.payAtLibraryToast'));
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader title={t('payment.pageTitle')} description={label} />

      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-muted-foreground">{t('payment.amountDue')}</p>
          {isLoadingPlan ? (
            <Loader />
          ) : (
            <div className="flex items-baseline gap-2">
              {appliedCoupon && (
                <span className="text-lg text-muted-foreground line-through">₹{baseAmount}</span>
              )}
              <span className="text-2xl font-semibold text-foreground">₹</span>
              <AnimatedNumber value={amount} className="text-4xl font-extrabold text-foreground" />
            </div>
          )}
          <Badge variant="outline">{label}</Badge>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1.5">
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-md border border-success/50 bg-success/10 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">
              {t('payment.coupon.applied', {
                code: appliedCoupon.code,
                percent: appliedCoupon.discount_percent,
              })}
            </span>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('payment.coupon.remove')}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder={t('payment.coupon.placeholder')}
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              disabled={isLoadingPlan}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleApplyCoupon}
              isLoading={isApplyingCoupon}
              disabled={isLoadingPlan || !couponCode.trim()}
            >
              {t('payment.coupon.apply')}
            </Button>
          </div>
        )}
        {couponError && <p className="text-sm text-danger">{couponError}</p>}
      </div>

      {isRenewal && (
        <p className="text-center text-sm text-muted-foreground">
          {t('payment.renewingCurrentPlan')}{' '}
          <Link to={ROUTES.PRICING} className="font-medium text-primary hover:underline">
            {t('payment.changePlan')}
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Temporary testing controls — real Razorpay checkout isn't wired up yet.
        </p>
        <div className="flex gap-2">
          <Button
            size="lg"
            className="flex-1 gap-2"
            onClick={handleSimulateSuccess}
            disabled={isLoadingPlan}
          >
            <CheckCircle2 className="size-4" />
            Simulate Success
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleSimulateFailure}
          >
            <XCircle className="size-4" />
            Simulate Failure
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        {t('auth.login.or')}
        <div className="h-px flex-1 bg-border" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Banknote className="size-4" />
            {t('payment.payAtLibraryTitle')}
          </p>
          <p className="text-sm text-muted-foreground">{t('payment.payAtLibraryDescription')}</p>
          <Button variant="outline" onClick={handlePayAtLibrary}>
            {t('payment.contactManager')}
          </Button>
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        {t('payment.secureNotice')}
      </p>
    </div>
  );
}
