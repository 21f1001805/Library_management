import type { ReactNode } from 'react';

import { RequireRole } from '@/providers/AuthGuard';

export default function Layout({ children }: { children: ReactNode }) {
  return <RequireRole allow={['manager', 'librarian']}>{children}</RequireRole>;
}
