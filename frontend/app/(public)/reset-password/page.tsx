import { Suspense } from 'react';

import { ResetPassword } from '@/screens/ResetPassword';
import { RedirectIfAuthenticated } from '@/providers/AuthGuard';

// useSearchParams() (to read the ?token= param) opts this page out of static rendering
// unless wrapped in Suspense — Next's required pattern for that hook.
export default function Page() {
  return (
    <RedirectIfAuthenticated>
      <Suspense>
        <ResetPassword />
      </Suspense>
    </RedirectIfAuthenticated>
  );
}
