import { useAuth } from '@/providers/AuthProvider';

import { ManagerDashboard } from './ManagerDashboard';
import { MemberDashboard } from './MemberDashboard';

export function DashboardPage() {
  const { role } = useAuth();

  if (role === 'manager' || role === 'librarian') return <ManagerDashboard />;
  return <MemberDashboard />;
}
