import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { useAuth, type Role } from '@/providers/AuthProvider';

import { BookStackArt } from './BookStackArt';
import { GrowthChartArt } from './GrowthChartArt';
import { ServerRackArt } from './ServerRackArt';

interface Promo {
  /** Key under `sidebar.promo` holding this variant's title/description/cta. */
  variant: string;
  to: string;
  art: ComponentType<{ className?: string }>;
}

const MEMBER_PROMO: Promo = { variant: 'member', to: ROUTES.BOOKS, art: BookStackArt };

/**
 * "Browse thousands of books" is a reader's prompt, not an admin's — so each role gets copy
 * about its own work, and a CTA pointing at a route that role's sidebar already carries
 * (see constants/navigation.ts), so the card can never send someone somewhere they can't go.
 * Manager and librarian share one variant: they share managerNavigation too.
 */
const PROMO_BY_ROLE: Partial<Record<Role, Promo>> = {
  admin: { variant: 'admin', to: ROUTES.ADMIN_PAYMENTS, art: GrowthChartArt },
  manager: { variant: 'staff', to: ROUTES.MANAGER_BOOKS, art: BookStackArt },
  librarian: { variant: 'staff', to: ROUTES.MANAGER_BOOKS, art: BookStackArt },
  'it-head': { variant: 'itHead', to: ROUTES.IT_HEAD, art: ServerRackArt },
  guardian: { variant: 'guardian', to: ROUTES.READING_PROGRESS, art: BookStackArt },
};

/**
 * Promo card at the foot of the sidebar. Rendered only while the sidebar is expanded —
 * there's nothing meaningful to show of it in the 4rem collapsed rail.
 */
export function SidebarPromo() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const promo = (role && PROMO_BY_ROLE[role]) ?? MEMBER_PROMO;
  const Art = promo.art;

  return (
    <div className="m-3 mt-1 overflow-hidden rounded-xl border border-primary/15 bg-primary/5 p-4 dark:border-primary/25 dark:bg-primary/10">
      <p className="text-sm font-semibold leading-snug text-foreground">
        {t(`sidebar.promo.${promo.variant}.title`)}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        {t(`sidebar.promo.${promo.variant}.description`)}
      </p>
      {/* A Link styled as a button (buttonVariants) rather than a Button with a navigate
          handler, so it keeps real anchor behaviour — middle-click, open in new tab. */}
      <Link to={promo.to} className={buttonVariants({ size: 'sm', className: 'mt-3 w-full' })}>
        {t(`sidebar.promo.${promo.variant}.cta`)}
      </Link>
      <Art className="mt-3 w-full" />
    </div>
  );
}
