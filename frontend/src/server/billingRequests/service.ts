import { prisma } from '@/server/db';
import { HttpError } from '@/server/http';
import { Role } from '@/server/constants';
import { AuditAction } from '@/server/auditLog/constants';
import * as auditLogService from '@/server/auditLog/service';
import * as notificationsService from '@/server/notifications/service';
import * as repository from '@/server/billingRequests/repository';
import {
  billingRequestToJson,
  type BillingRequestCreateInput,
  type BillingRequestOut,
  type WaiveFineRequestInput,
} from '@/server/billingRequests/schemas';

// Mirrors backend/src/app/modules/billing_requests/service.py.
type DecisionKey = 'refund:approved' | 'refund:rejected' | 'fee_waiver:approved' | 'fee_waiver:rejected';
const DECISION_ACTIONS: Record<DecisionKey, string> = {
  'refund:approved': AuditAction.REFUND_ISSUED,
  'refund:rejected': AuditAction.REFUND_REJECTED,
  'fee_waiver:approved': AuditAction.FEE_WAIVED,
  'fee_waiver:rejected': AuditAction.FEE_WAIVER_REJECTED,
};

const TYPE_LABELS: Record<string, string> = { refund: 'refund', fee_waiver: 'fee waiver' };

async function notifyAdmins(message: string): Promise<void> {
  await notificationsService.notifyRoles([Role.ADMIN], 'pending-request', message);
}

export async function listPendingRequests(): Promise<BillingRequestOut[]> {
  const rows = await repository.listPending();
  return rows.map(billingRequestToJson);
}

export async function createRequest(
  createdById: string,
  payload: BillingRequestCreateInput,
): Promise<BillingRequestOut> {
  const row = await repository.create({
    memberId: payload.member_id,
    createdById,
    type: payload.type,
    amount: payload.amount,
    reason: payload.reason,
  });

  await notifyAdmins(
    `${row.createdBy.fullName} filed a ₹${row.amount} ${TYPE_LABELS[row.type]} request ` +
      `for ${row.member.fullName}.`,
  );
  return billingRequestToJson(row);
}

// Admin acting directly, not the manager-files/admin-approves flow: the admin is both
// filer and approver, so this creates the request already decided — it never shows up
// in the pending queue.
export async function waiveFine(
  adminId: string,
  payload: WaiveFineRequestInput,
): Promise<BillingRequestOut> {
  let row = await repository.create({
    memberId: payload.member_id,
    createdById: adminId,
    type: 'fee_waiver',
    amount: payload.amount,
    reason: payload.reason,
  });

  row = await repository.decide(row.id, { status: 'approved', decidedById: adminId });
  await auditLogService.record({
    actorId: adminId,
    action: AuditAction.FEE_WAIVED,
    metadata: { amount: row.amount, memberName: row.member.fullName },
  });
  return billingRequestToJson(row);
}

export async function approveRequest(
  requestId: string,
  decidedById: string,
): Promise<BillingRequestOut> {
  return decide(requestId, decidedById, 'approved');
}

export async function rejectRequest(requestId: string, decidedById: string): Promise<BillingRequestOut> {
  return decide(requestId, decidedById, 'rejected');
}

async function decide(
  requestId: string,
  decidedById: string,
  statusValue: 'approved' | 'rejected',
): Promise<BillingRequestOut> {
  const existing = await repository.findById(requestId);
  if (!existing) throw new HttpError(404, 'Request not found');
  if (existing.status !== 'pending') {
    throw new HttpError(409, 'This request has already been decided');
  }

  const row = await prisma.$transaction(async (tx) => {
    const decided = await repository.decideIfPending(requestId, {
      status: statusValue,
      decidedById,
      client: tx,
    });
    if (!decided) throw new HttpError(409, 'This request has already been decided');
    await auditLogService.record({
      actorId: decidedById,
      action: DECISION_ACTIONS[`${decided.type as 'refund' | 'fee_waiver'}:${statusValue}`],
      metadata: { amount: decided.amount, memberName: decided.member.fullName },
      client: tx,
    });
    return decided;
  });

  return billingRequestToJson(row);
}
