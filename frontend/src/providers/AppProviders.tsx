import { type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';

import { ChatbotWidget } from '@/components/layout';

import { ActiveSectionProvider } from './ActiveSectionProvider';
import { AuthProvider } from './AuthProvider';
import { LanguageProvider } from './LanguageProvider';

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    // reduceMotion="user" makes every Framer Motion animation site-wide honor prefers-reduced-motion
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <AuthProvider>
          <ActiveSectionProvider>
            {children}
            <ChatbotWidget />
            <Toaster richColors closeButton position="top-right" />
          </ActiveSectionProvider>
        </AuthProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}
