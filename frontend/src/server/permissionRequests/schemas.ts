import { z } from 'zod';

import type { PermissionRequestWithRelations } from '@/server/permissionRequests/repository';

// Mirrors backend/src/app/modules/permission_requests/schemas.py.
export const permissionRequestCreateSchema = z.object({
  permission: z.string().min(1).max(100),
  reason: z.string().min(1).max(500),
});
export type PermissionRequestCreateInput = z.infer<typeof permissionRequestCreateSchema>;

export interface PermissionRequestOut {
  id: string;
  permission: string;
  reason: string;
  status: string;
  requested_by_id: string;
  requested_by_name: string;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
}

export function permissionRequestToJson(row: PermissionRequestWithRelations): PermissionRequestOut {
  return {
    id: row.id,
    permission: row.permission,
    reason: row.reason,
    status: row.status,
    requested_by_id: row.requestedById,
    requested_by_name: row.requestedBy.fullName,
    decided_by_name: row.decidedBy?.fullName ?? null,
    decided_at: row.decidedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}
