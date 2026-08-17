import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/cn';
import { useScroll } from '@/lib/useScroll';
import { useAuth } from '@/providers/AuthProvider';

import { DesktopNavigation } from './DesktopNavigation';
import { Logo } from './Logo';
import { MobileNavDrawer, MobileNavToggle } from './MobileNavigation';
import { useHeaderNavLinks } from './NavigationLinks';

export function Header() {
  const { isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const scrolled = useScroll(10);
  const navLinks = useHeaderNavLinks();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function handleLogout() {
    logout();
    navigate(ROUTES.HOME);
    setOpen(false);
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-20 mx-auto w-full max-w-6xl border-b border-transparent',
        'lg:rounded-2xl lg:border lg:transition-all lg:duration-300 lg:ease-out',
        scrolled &&
          !open &&
          'border-border bg-surface/90 shadow-panel backdrop-blur-lg supports-backdrop-filter:bg-surface/70 lg:top-3 lg:max-w-5xl',
        open && 'bg-surface',
      )}
    >
      <nav
        className={cn(
          'flex h-16 items-center justify-between px-4 transition-all duration-300 ease-out sm:px-6',
          scrolled && 'lg:h-14',
        )}
      >
        <Logo onClick={() => setOpen(false)} />

        <DesktopNavigation
          links={navLinks}
          isAuthenticated={isAuthenticated}
          role={role}
          onLogout={handleLogout}
        />

        <MobileNavToggle open={open} onToggle={() => setOpen((value) => !value)} />
      </nav>

      <MobileNavDrawer
        open={open}
        links={navLinks}
        isAuthenticated={isAuthenticated}
        role={role}
        onLogout={handleLogout}
        onNavigate={() => setOpen(false)}
      />
    </header>
  );
}
