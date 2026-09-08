import { HttpError } from '@/server/http';
import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as repository from '@/server/permissionRequests/repository';
import {
  permissionRequestToJson,
  type PermissionRequestCreateInput,
  type PermissionRequestOut,
} from '@/server/permissionRequests/schemas';

// Mirrors backend/src/app/modules/permission_requests/service.py.
export async function listPendingRequests(): Promise<PermissionRequestOut[]> {
  const rows = await repository.listPending();
  return rows.map(permissionRequestToJson);
}

export async function createRequest(
  requestedById: string,
  payload: PermissionRequestCreateInput,
): Promise<PermissionRequestOut> {
  const row = await repository.create({
    requestedById,
    permission: payload.permission,
    reason: payload.reason,
  });
  return permissionRequestToJson(row);
}

export async function grantRequest(
  requestId: string,
  decidedById: string,
): Promise<PermissionRequestOut> {
  return decide(requestId, decidedById, 'granted');
}

export async function denyRequest(
  requestId: string,
  decidedById: string,
): Promise<PermissionRequestOut> {
  return decide(requestId, decidedById, 'denied');
}

async function decide(
  requestId: string,
  decidedById: string,
  statusValue: 'granted' | 'denied',
): Promise<PermissionRequestOut> {
  const existing = await repository.findById(requestId);
  if (!existing) throw new HttpError(404, 'Request not found');
  if (existing.status !== 'pending') {
    throw new HttpError(409, 'This request has already been decided');
  }

  const row = await repository.decideIfPending(requestId, { status: statusValue, decidedById });
  if (!row) throw new HttpError(409, 'This request has already been decided');

  // Access decisions are exactly what an audit trail is for.
  await auditLogService.record({
    actorId: decidedById,
    action:
      statusValue === 'granted'
        ? AuditAction.PERMISSION_REQUEST_GRANTED
        : AuditAction.PERMISSION_REQUEST_DENIED,
    metadata: {
      requestId,
      requestedById: existing.requestedById,
      permission: existing.permission,
    },
  });
  return permissionRequestToJson(row);
}
