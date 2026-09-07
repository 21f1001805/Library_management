import type { ReactNode } from 'react';

import { ITHeadLayout } from '@/app/layouts/ITHeadLayout';
import { RequireRole } from '@/providers/AuthGuard';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole allow={['it-head']}>
      <ITHeadLayout>{children}</ITHeadLayout>
    </RequireRole>
  );
}
