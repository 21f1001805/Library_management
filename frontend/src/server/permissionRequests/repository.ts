import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/permission_requests/repository.py.
const INCLUDE = { requestedBy: true, decidedBy: true } satisfies Prisma.PermissionRequestInclude;
export type PermissionRequestWithRelations = Prisma.PermissionRequestGetPayload<{ include: typeof INCLUDE }>;

// Self-limiting in practice — granted/denied requests leave this filter — but capped
// anyway rather than trusting that a growing backlog never outpaces it.
const LIST_LIMIT = 200;

export async function countPending(): Promise<number> {
  return prisma.permissionRequest.count({ where: { status: 'pending' } });
}

export async function listPending(): Promise<PermissionRequestWithRelations[]> {
  return prisma.permissionRequest.findMany({
    where: { status: 'pending' },
    include: INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: LIST_LIMIT,
  });
}

export async function findById(requestId: string): Promise<PermissionRequestWithRelations | null> {
  return prisma.permissionRequest.findUnique({ where: { id: requestId }, include: INCLUDE });
}

export async function create(opts: {
  requestedById: string;
  permission: string;
  reason: string;
}): Promise<PermissionRequestWithRelations> {
  return prisma.permissionRequest.create({
    data: { requestedById: opts.requestedById, permission: opts.permission, reason: opts.reason },
    include: INCLUDE,
  });
}

export async function decideIfPending(
  requestId: string,
  opts: { status: string; decidedById: string },
): Promise<PermissionRequestWithRelations | null> {
  const updated = await prisma.permissionRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: opts.status, decidedById: opts.decidedById, decidedAt: new Date() },
  });
  if (updated.count !== 1) return null;
  return findById(requestId);
}
