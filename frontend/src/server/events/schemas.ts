import { z } from 'zod';

import type { EventWithRelations } from '@/server/events/repository';

// Mirrors backend/src/app/modules/events/schemas.py. Events are scheduled, not
// recorded — a past date at creation is always a typo (see the Python docstring this
// mirrors); deliberately applied to creation only, since the edit form resends every
// field including `date` and a finished event must stay editable.
const futureDate = z.coerce.date().refine((value) => value >= new Date(), {
  message: 'Event date must be in the future',
});

export const eventCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  location: z.string().min(1).max(255),
  date: futureDate,
  capacity: z.number().int().positive(),
  manager_ids: z.array(z.string()).default([]),
});
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  location: z.string().min(1).max(255).nullable().optional(),
  date: z.coerce.date().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  // None/omitted = leave assignments unchanged; a list (even empty) replaces the whole set.
  manager_ids: z.array(z.string()).nullable().optional(),
});
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

export interface RegistrantOut {
  id: string;
  full_name: string;
  email: string;
}

export interface EventOut {
  id: string;
  title: string;
  description: string | null;
  location: string;
  date: string;
  capacity: number;
  attendees: number;
  registered: boolean;
  registrants: RegistrantOut[];
  assigned_managers: RegistrantOut[];
  created_at: string;
}

export function eventToJson(event: EventWithRelations, memberId?: string | null): EventOut {
  const registrants = event.registrations ?? [];
  const assignments = event.managerAssignments ?? [];
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    date: event.date.toISOString(),
    capacity: event.capacity,
    attendees: registrants.length,
    registered: memberId ? registrants.some((r) => r.memberId === memberId) : false,
    registrants: registrants.map((r) => ({
      id: r.member.id,
      full_name: r.member.fullName,
      email: r.member.email,
    })),
    assigned_managers: assignments.map((a) => ({
      id: a.manager.id,
      full_name: a.manager.fullName,
      email: a.manager.email,
    })),
    created_at: event.createdAt.toISOString(),
  };
}

export interface EventListResponse {
  items: EventOut[];
  total: number;
}

export interface AttendanceSummary {
  total_events_this_month: number;
  total_attendees: number;
  average_attendance_rate: number;
}

export interface EventAnalyticsRegistrant {
  id: string;
  full_name: string;
  email: string;
  role: string;
  registered_at: string;
}

export interface RoleBreakdown {
  role: string;
  count: number;
}

export interface EventAnalytics {
  event_id: string;
  title: string;
  date: string;
  location: string;
  capacity: number;
  total_registered: number;
  fill_rate: number;
  registrants_by_role: RoleBreakdown[];
  registrants: EventAnalyticsRegistrant[];
}
