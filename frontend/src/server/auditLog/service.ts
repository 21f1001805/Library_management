import type { Prisma } from '@prisma/client';

import * as repository from '@/server/auditLog/repository';

// Mirrors backend/src/app/modules/audit_log/service.py's record(). list_entries() (the
// admin log viewer) is added alongside audit_log's own router in a later phase.
export async function record(opts: {
  actorId: string;
  action: string;
  metadata: Prisma.InputJsonValue;
  client?: Prisma.TransactionClient;
}): Promise<void> {
  await repository.create(opts);
}
