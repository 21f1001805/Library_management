'use client';

// See AdminLayout.tsx's comment — itHeadNavigation's icon function references need this to
// be a Client Component too, or passing them to AppShellLayout crosses an RSC boundary.

import type { ReactNode } from 'react';

import { itHeadNavigation } from '@/constants/navigation';

import { AppShellLayout } from './AppShellLayout';

export function ITHeadLayout({ children }: { children: ReactNode }) {
  return <AppShellLayout items={itHeadNavigation}>{children}</AppShellLayout>;
}
