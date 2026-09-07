import { Suspense } from 'react';

import { PaymentPage } from '@/features/payment/pages/PaymentPage';

// useSearchParams() (to read ?plan=/?amount=/?label=) opts this page out of static
// rendering unless wrapped in Suspense — Next's required pattern for that hook.
export default function Page() {
  return (
    <Suspense>
      <PaymentPage />
    </Suspense>
  );
}
