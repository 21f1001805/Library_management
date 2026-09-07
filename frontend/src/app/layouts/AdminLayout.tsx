'use client';

// adminNavigation's NavItem entries carry a Lucide icon *function* reference — passing that
// to AppShellLayout (a Client Component) from a Server Component fails RSC's serialization
// rule ("Functions cannot be passed directly to Client Components"). Making this file a
// Client Component too turns that into a client-to-client prop pass, which has no such
// restriction — its own Server Component caller (app/admin/layout.tsx) only ever passes it
// `children` (always serializable, since it's JSX).

import type { ReactNode } from 'react';

import { adminNavigation } from '@/constants/navigation';

import { AppShellLayout } from './AppShellLayout';

export function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShellLayout items={adminNavigation}>{children}</AppShellLayout>;
}
