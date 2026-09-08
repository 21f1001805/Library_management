import type { AuditLogEntry, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/audit_log/repository.py.
const INCLUDE = { actor: { include: { role: true } } } satisfies Prisma.AuditLogEntryInclude;
export type AuditLogEntryWithActor = Prisma.AuditLogEntryGetPayload<{ include: typeof INCLUDE }>;

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

export async function listRecent(opts: {
  page: number;
  pageSize: number;
}): Promise<[AuditLogEntryWithActor[], number]> {
  const total = await prisma.auditLogEntry.count({ where: {} });
  const items = await prisma.auditLogEntry.findMany({
    where: {},
    orderBy: { createdAt: 'desc' },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
    include: INCLUDE,
  });
  return [items, total];
}
