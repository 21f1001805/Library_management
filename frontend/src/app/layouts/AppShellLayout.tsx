import { Outlet } from 'react-router-dom';

import { Footer, Sidebar, TopBar } from '@/components/layout';
import type { NavItem } from '@/constants/navigation';

export interface AppShellLayoutProps {
  items: NavItem[];
}

export function AppShellLayout({ items }: AppShellLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:block">
        <Sidebar items={items} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar items={items} />
        {/* pb-24 reserves space under the fixed ChatbotWidget (size-14 button + margin) so it
            never sits on top of the last row of dashboard controls. */}
        <main className="flex-1 p-6 pb-24">
          <Outlet />
        </main>
        <Footer minimal />
      </div>
    </div>
  );
}
