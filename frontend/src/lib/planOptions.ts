import { useEffect, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

export interface PlanOption {
  value: string;
  label: string;
  price: number;
  months: number;
}

const MONTH_LABEL: Record<string, string> = {
  '1m': '1 Month',
  '3m': '3 Months',
  '6m': '6 Months',
  '12m': '12 Months',
};

// ponytail: reuses the Pricing page's real, backend-seeded plan prices instead of the
// old unpriced basic/standard/premium tiers, so Payment always gets a real amount.
export function usePlanOptions(): { options: PlanOption[]; isLoading: boolean } {
  const { getPricingPlans } = useAuth();
  const [options, setOptions] = useState<PlanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPricingPlans()
      .then((plans) => {
        if (cancelled) return;
        setOptions(
          plans.map((plan) => ({
            value: plan.plan_id,
            label: `${MONTH_LABEL[plan.plan_id] ?? plan.plan_id} — ₹${plan.price.toLocaleString('en-IN')}`,
            price: plan.price,
            months: plan.months,
          })),
        );
      })
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { options, isLoading };
}
