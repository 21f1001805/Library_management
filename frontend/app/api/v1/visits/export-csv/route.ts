import { withErrorHandling } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import * as visitsService from '@/server/visits/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.MANAGER, Role.LIBRARIAN, Role.ADMIN);
  const csvContent = await visitsService.exportActiveVisitsCsv();
  const todayStr = new Date().toISOString().slice(0, 10);
  const filename = `library-currently-present-${todayStr}.csv`;
  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  });
});
