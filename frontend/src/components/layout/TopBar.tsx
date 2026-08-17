import { useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Drawer, Modal } from '@/components/ui';
import type { NavItem } from '@/constants/navigation';
import { NotificationsPanel } from '@/features/notifications/components/NotificationsPanel';
import { useUnreadNotifications } from '@/features/notifications/hooks/useUnreadNotifications';
import { cn } from '@/lib/cn';

import { LanguageSwitcher } from './LanguageSwitcher';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';

export interface TopBarProps {
  items: NavItem[];
}

export function TopBar({ items }: TopBarProps) {
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { unreadCount, justArrived, refresh } = useUnreadNotifications();

  return (
    <header className="flex h-16 items-center justify-between gap-1 border-b border-border bg-surface px-4">
      <Button
        variant="ghost"
        size="sm"
        className="size-10 p-0 md:hidden"
        aria-label={t('topBar.openNavigation')}
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        className="relative size-10 p-0"
        aria-label={
          unreadCount > 0
            ? t('notifications.pageTitleWithUnread', { count: unreadCount })
            : t('notifications.pageTitle')
        }
        onClick={() => setNotificationsOpen(true)}
      >
        <Bell
          className={cn(
            'size-5',
            unreadCount > 0 ? 'text-warning' : 'text-muted-foreground',
            justArrived && 'animate-bounce',
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-warning ring-2 ring-surface" />
        )}
      </Button>
      <LanguageSwitcher className="text-muted-foreground" />
      <UserMenu />

      <Modal
        open={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false);
          refresh();
        }}
        title={t('notifications.pageTitle')}
        className="max-w-lg"
      >
        <NotificationsPanel />
      </Modal>

      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        title={t('topBar.menu')}
        side="left"
      >
        <Sidebar items={items} />
      </Drawer>
    </header>
  );
}
