import { z } from 'zod';

import type { LibraryVisitWithRelations } from '@/server/visits/repository';

// Mirrors backend/src/app/modules/visits/schemas.py.
export const checkInCreateSchema = z.object({ member_id: z.string() });
export type CheckInCreateInput = z.infer<typeof checkInCreateSchema>;

export const checkOutCreateSchema = z.object({ member_id: z.string() });
export type CheckOutCreateInput = z.infer<typeof checkOutCreateSchema>;

export interface LibraryVisitOut {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  checked_in_at: string;
  checked_out_at: string | null;
  recorded_by_id: string;
  recorded_by_name: string | null;
  is_currently_inside: boolean;
}

export function libraryVisitToJson(visit: LibraryVisitWithRelations): LibraryVisitOut {
  return {
    id: visit.id,
    member_id: visit.memberId,
    member_name: visit.member?.fullName ?? '',
    member_email: visit.member?.email ?? '',
    checked_in_at: visit.checkedInAt.toISOString(),
    checked_out_at: visit.checkedOutAt?.toISOString() ?? null,
    recorded_by_id: visit.recordedById,
    recorded_by_name: visit.recordedBy?.fullName ?? null,
    is_currently_inside: visit.checkedOutAt === null,
  };
}

export interface MemberVisitStatusOut {
  member_id: string;
  is_in_library: boolean;
  checked_in_at: string | null;
  last_checked_out_at: string | null;
  latest_visit_id: string | null;
}

export interface ChildVisitStatusOut {
  child_id: string;
  child_name: string;
  child_email: string;
  is_in_library: boolean;
  checked_in_at: string | null;
  last_checked_out_at: string | null;
}
