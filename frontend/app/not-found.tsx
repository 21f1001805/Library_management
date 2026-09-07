import PublicGroupLayout from './(public)/layout';
import { NotFound } from '@/screens/NotFound';

// Next's global not-found — reuses the (public) route group's layout directly (rather than
// relying on file-based nesting, which only applies to explicit notFound() calls within
// that segment) so an unmatched URL still gets the site header/footer.
export default function NotFoundPage() {
  return (
    <PublicGroupLayout>
      <NotFound />
    </PublicGroupLayout>
  );
}
