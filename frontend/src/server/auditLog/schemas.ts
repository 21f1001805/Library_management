import type { AuditLogEntryWithActor } from '@/server/auditLog/repository';

// Mirrors backend/src/app/modules/audit_log/schemas.py.
export interface AuditLogEntryOut {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  params: unknown;
  created_at: string;
}

export function auditLogEntryToJson(row: AuditLogEntryWithActor): AuditLogEntryOut {
  return {
    id: row.id,
    actor_id: row.actorId,
    actor_name: row.actor.fullName,
    actor_role: row.actor.role.name,
    action: row.action,
    params: row.metadata,
    created_at: row.createdAt.toISOString(),
  };
}

export interface AuditLogListResponse {
  items: AuditLogEntryOut[];
  total: number;
  page: number;
  page_size: number;
}
