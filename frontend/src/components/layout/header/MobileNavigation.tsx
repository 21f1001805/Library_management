import { useTranslation } from 'react-i18next';

import { Button, MenuToggleIcon } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Role } from '@/providers/AuthProvider';

import { AuthActions } from './AuthActions';
import { NavigationLinks, type HeaderNavLink } from './NavigationLinks';

export interface MobileNavToggleProps {
  open: boolean;
  onToggle: () => void;
}

// Hamburger button rendered inline in the header's nav row.
export function MobileNavToggle({ open, onToggle }: MobileNavToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 lg:hidden">
      <Button variant="ghost" size="sm" onClick={onToggle} aria-label={t('topBar.openNavigation')}>
        <MenuToggleIcon open={open} duration={300} />
      </Button>
    </div>
  );
}

export interface MobileNavDrawerProps {
  open: boolean;
  links: HeaderNavLink[];
  isAuthenticated: boolean;
  role: Role | null;
  onLogout: () => void;
  onNavigate: () => void;
}

// The full-screen slide-down panel opened by MobileNavToggle.
export function MobileNavDrawer({
  open,
  links,
  isAuthenticated,
  role,
  onLogout,
  onNavigate,
}: MobileNavDrawerProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 top-16 bottom-0 z-20 flex flex-col border-t border-border bg-surface',
        'transition-opacity duration-300 ease-out lg:hidden',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex h-full flex-col justify-between gap-6 p-4">
        <div className="grid gap-1">
          <NavigationLinks links={links} variant="mobile" onNavigate={onNavigate} />
        </div>

        <div className="flex flex-col gap-2">
          <AuthActions
            isAuthenticated={isAuthenticated}
            role={role}
            onLogout={onLogout}
            onNavigate={onNavigate}
            variant="mobile"
          />
        </div>
      </div>
    </div>
  );
}
