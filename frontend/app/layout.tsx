import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/feedback';
import { AppProviders } from '@/providers/AppProviders';

import '@/styles.css';

export const metadata: Metadata = {
  title: 'Library Management',
  description: 'Borrow, reserve, and manage books, seats, and memberships.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AppProviders>{children}</AppProviders>
        </ErrorBoundary>
      </body>
    </html>
  );
}
