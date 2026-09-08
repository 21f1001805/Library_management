import type { Prisma } from '@prisma/client';

import * as repository from '@/server/auditLog/repository';
import { auditLogEntryToJson, type AuditLogListResponse } from '@/server/auditLog/schemas';

// Mirrors backend/src/app/modules/audit_log/service.py.
export async function record(opts: {
  actorId: string;
  action: string;
  metadata: Prisma.InputJsonValue;
  client?: Prisma.TransactionClient;
}): Promise<void> {
  await repository.create(opts);
}

export async function listEntries(opts: {
  page: number;
  pageSize: number;
}): Promise<AuditLogListResponse> {
  const [rows, total] = await repository.listRecent(opts);
  return {
    items: rows.map(auditLogEntryToJson),
    total,
    page: opts.page,
    page_size: opts.pageSize,
  };
}
