'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Footer, Header } from '@/components/layout';
import { Footer as LandingFooter } from '@/features/landing/components/Footer';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/cn';

// Ported from src/app/layouts/PublicLayout.tsx. Next's App Router restores scroll position
// on navigation itself, so <ScrollRestoration/> (a react-router-dom-only concern) is dropped.
const largeFooterRoutes: string[] = [
  ROUTES.PRICING,
  ROUTES.CONTACT_US,
  ROUTES.LOGIN,
  ROUTES.REGISTER,
];

export default function PublicGroupLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === ROUTES.HOME;
  const isLargeFooterPage = largeFooterRoutes.includes(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* pb-24 reserves space under the fixed ChatbotWidget (size-14 button + margin).
          Skipped whenever the large Footer follows (landing page, and largeFooterRoutes
          below): it's a 70vh block that already clears the widget on its own. */}
      <main className={cn('flex-1', !isLandingPage && !isLargeFooterPage && 'pb-24')}>
        {children}
      </main>
      {isLandingPage ? null : isLargeFooterPage ? (
        <LandingFooter sticky={false} />
      ) : (
        <Footer minimal />
      )}
    </div>
  );
}
