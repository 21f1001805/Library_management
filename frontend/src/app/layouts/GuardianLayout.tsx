'use client';

// See AdminLayout.tsx's comment — guardianNavigation's icon function references need this to
// be a Client Component too, or passing them to AppShellLayout crosses an RSC boundary.

import type { ReactNode } from 'react';

import { guardianNavigation } from '@/constants/navigation';

import { AppShellLayout } from './AppShellLayout';

export function GuardianLayout({ children }: { children: ReactNode }) {
  return <AppShellLayout items={guardianNavigation}>{children}</AppShellLayout>;
}
