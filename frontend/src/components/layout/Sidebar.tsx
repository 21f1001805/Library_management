'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import type { NavItem } from '@/constants/navigation';

export interface SidebarProps {
  items: NavItem[];
  onNavigate?: () => void;
  id?: string;
  /** Icon-only rail. Only AppShellLayout's desktop aside sets this — the mobile drawer
   *  has the full width to spare, so it always renders labelled. */
  collapsed?: boolean;
}

export function Sidebar({ items, onNavigate, id, collapsed = false }: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <nav id={id} className="flex flex-col gap-1 p-3">
      {items.map(({ label, path, icon: Icon }) => {
        const text = t(label);
        // Every nav item here used react-router's `end` (exact-match only), so a plain
        // equality check reproduces that with no prefix-match branch needed.
        const isActive = pathname === path;
        return (
          <Link
            key={path}
            href={path}
            onClick={onNavigate}
            title={collapsed ? text : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground',
              collapsed && 'justify-center px-0',
              isActive && 'bg-secondary text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {/* Kept in the DOM rather than removed when collapsed, so the link still has an
                accessible name for screen readers while showing only its icon. */}
            <span className={cn(collapsed && 'sr-only')}>{text}</span>
          </Link>
        );
      })}
    </nav>
  );
}
