import type { ReactNode } from 'react';

import { AdminLayout } from '@/app/layouts/AdminLayout';
import { RequireRole } from '@/providers/AuthGuard';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole allow={['admin']}>
      <AdminLayout>{children}</AdminLayout>
    </RequireRole>
  );
}
