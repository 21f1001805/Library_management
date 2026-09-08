import { prisma } from '@/server/db';

// Minimal subset of backend/src/app/modules/billing_requests/repository.py — just the
// count the manager dashboard needs. The full module (create/approve/reject, its own
// router) is phase 6 (billing & growth).
export async function countPending(): Promise<number> {
  return prisma.billingRequest.count({ where: { status: 'pending' } });
}
