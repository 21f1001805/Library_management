import { Login } from '@/screens/Login';
import { RedirectIfAuthenticated } from '@/providers/AuthGuard';

export default function Page() {
  return (
    <RedirectIfAuthenticated>
      <Login />
    </RedirectIfAuthenticated>
  );
}
