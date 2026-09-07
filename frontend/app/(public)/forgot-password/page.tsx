import { ForgotPassword } from '@/screens/ForgotPassword';
import { RedirectIfAuthenticated } from '@/providers/AuthGuard';

export default function Page() {
  return (
    <RedirectIfAuthenticated>
      <ForgotPassword />
    </RedirectIfAuthenticated>
  );
}
