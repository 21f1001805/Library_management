import { z } from 'zod';

import type { ReadingProgressOut } from '@/server/members/schemas';

// Mirrors backend/src/app/modules/guardian/schemas.py.
export const guardianLinkCreateSchema = z.object({
  guardian_id: z.string(),
  member_id: z.string(),
});
export type GuardianLinkCreateInput = z.infer<typeof guardianLinkCreateSchema>;

export const selfGuardianLinkCreateSchema = z.object({
  guardian_email: z.string().email(),
});
export type SelfGuardianLinkCreateInput = z.infer<typeof selfGuardianLinkCreateSchema>;

// The guardian a member is linked to, as shown on their own settings page.
export interface GuardianContactOut {
  id: string;
  full_name: string;
  email: string;
  linked_at: string;
}

export interface GuardianChildOut {
  id: string;
  full_name: string;
  email: string;
  currently_reading: ReadingProgressOut[];
  completed: ReadingProgressOut[];
  outstanding_fine: number;
  fine_book_title: string | null;
  fine_due_date: string | null;
  subscription_expires_on: string | null;
}
