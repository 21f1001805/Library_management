'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { buttonVariants } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/cn';
import { preferredScrollBehavior } from '@/lib/scroll';
import { useActiveSection } from '@/providers/ActiveSectionProvider';

export interface HeaderNavLink {
  label: string;
  to: string;
  end: boolean;
  onClick?: (event: React.MouseEvent) => void;
  /**
   * Overrides the isActive check below. Needed because "Home" and "Reviews" both resolve
   * to the same pathname (the hash isn't part of the pathname Next gives us either), so
   * without this both would light up together any time we're on the home route.
   */
  forceActive?: boolean;
}

// Next's <Link> has no built-in NavLink-style active-state helper — this mirrors
// react-router's NavLink default: `end` means only an exact pathname match counts,
// otherwise a path segment prefix also counts (so e.g. a future /pricing/plan still
// lights up "Pricing"). `to` may carry a #hash (the Reviews link) which never appears
// in the pathname, so it's stripped before comparing.
function isPathActive(pathname: string, to: string, end: boolean): boolean {
  const path = to.split('#')[0] || '/';
  if (end) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

// Translated nav links shared by the desktop bar and the mobile drawer.
export function useHeaderNavLinks(): HeaderNavLink[] {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { activeSection } = useActiveSection();

  // If already on the landing page, smooth-scroll to the testimonials section instead of
  // reloading the route; otherwise let the Link navigate home and LandingPage scrolls on mount.
  function reviewsClickHandler(event: React.MouseEvent) {
    if (pathname === ROUTES.HOME) {
      event.preventDefault();
      const el = document.getElementById('testimonials');
      if (el) el.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
    }
  }

  const isOnHome = pathname === ROUTES.HOME;
  const isReviewsActive = isOnHome && activeSection === 'testimonials';

  return [
    {
      label: t('landing.footer.home'),
      to: ROUTES.HOME,
      end: true,
      forceActive: isOnHome && !isReviewsActive,
    },
    { label: t('nav.pricing'), to: ROUTES.PRICING, end: false },
    {
      label: t('nav.reviews'),
      to: `${ROUTES.HOME}#testimonials`,
      end: true,
      onClick: reviewsClickHandler,
      forceActive: isReviewsActive,
    },
    { label: t('nav.contactUs'), to: ROUTES.CONTACT_US, end: false },
  ];
}

export interface NavigationLinksProps {
  links: HeaderNavLink[];
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}

export function NavigationLinks({ links, variant = 'desktop', onNavigate }: NavigationLinksProps) {
  const isMobile = variant === 'mobile';
  const pathname = usePathname();

  return (
    <>
      {links.map(({ label, to, end, onClick, forceActive }) => {
        const isActive = forceActive ?? isPathActive(pathname, to, end);
        return (
          <Link
            key={to}
            href={to}
            onClick={(event) => {
              onClick?.(event);
              onNavigate?.();
            }}
            className={cn(
              buttonVariants({ variant: 'ghost', size: isMobile ? 'md' : 'sm' }),
              isMobile && 'justify-start',
              isActive && 'text-primary',
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
