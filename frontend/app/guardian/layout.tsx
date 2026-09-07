import type { ReactNode } from 'react';

import { GuardianLayout } from '@/app/layouts/GuardianLayout';
import { RequireRole } from '@/providers/AuthGuard';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole allow={['guardian']}>
      <GuardianLayout>{children}</GuardianLayout>
    </RequireRole>
  );
}
