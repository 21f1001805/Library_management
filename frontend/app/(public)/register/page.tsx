import { Register } from '@/screens/Register';
import { RedirectIfAuthenticated } from '@/providers/AuthGuard';

export default function Page() {
  return (
    <RedirectIfAuthenticated>
      <Register />
    </RedirectIfAuthenticated>
  );
}
