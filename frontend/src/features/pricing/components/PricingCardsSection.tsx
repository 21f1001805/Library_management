import { useEffect, useState } from 'react';

import { FadeUp, Section } from '@/components/common';
import { Loader } from '@/components/ui';
import { useAuth, type PricingPlan } from '@/providers/AuthProvider';

import { DurationToggle } from './DurationToggle';
import { PricingCard } from './PricingCard';

export function PricingCardsSection() {
  const { getPricingPlans } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  // Defaults to the "Most Popular" plan so first-time visitors see the recommended option highlighted.
  const [active, setActive] = useState('3m');

  useEffect(() => {
    getPricingPlans()
      .then(setPlans)
      .catch(() => setPlans([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Section ariaLabel="Pricing plans" tone="secondary">
      <FadeUp>
        <div className="flex justify-center">
          <DurationToggle plans={plans} active={active} onChange={setActive} />
        </div>
      </FadeUp>

      {plans.length === 0 ? (
        <div className="mt-12 flex justify-center">
          <Loader />
        </div>
      ) : (
        <div className="bg-background mt-12 rounded-3xl border border-border p-6 shadow-panel">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:items-start">
            {plans.map((plan, index) => (
              <PricingCard
                key={plan.plan_id}
                duration={plan}
                isActive={plan.plan_id === active}
                index={index}
                onSelect={() => setActive(plan.plan_id)}
              />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
