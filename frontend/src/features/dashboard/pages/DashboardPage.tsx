import { useAuth } from '@/providers/AuthProvider';

import { ManagerDashboard } from './ManagerDashboard';
import { MemberDashboard } from './MemberDashboard';

export function DashboardPage() {
  const { role } = useAuth();

  if (role === 'manager') return <ManagerDashboard />;
  return <MemberDashboard />;
}
