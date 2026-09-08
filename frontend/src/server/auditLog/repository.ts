import type { AuditLogEntry, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/audit_log/repository.py's create() — the write path
// several earlier-phase modules call directly. list_recent() (backing the admin log
// viewer) is added alongside audit_log's own router in a later phase.
const INCLUDE = { actor: { include: { role: true } } } satisfies Prisma.AuditLogEntryInclude;

export async function create(opts: {
  actorId: string;
  action: string;
  metadata: Prisma.InputJsonValue;
  client?: Prisma.TransactionClient;
}): Promise<AuditLogEntry> {
  const db = opts.client ?? prisma;
  return db.auditLogEntry.create({
    data: { actorId: opts.actorId, action: opts.action, metadata: opts.metadata },
    include: INCLUDE,
  });
}
