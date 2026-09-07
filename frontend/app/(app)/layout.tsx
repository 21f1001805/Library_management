import type { ReactNode } from 'react';

import { UserLayout } from '@/app/layouts/UserLayout';
import { RequireAuth } from '@/providers/AuthGuard';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <UserLayout>{children}</UserLayout>
    </RequireAuth>
  );
}
