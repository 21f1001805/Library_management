import { HttpError } from '@/server/http';
import type { AuthenticatedUser } from '@/server/auth/guards';
import * as guardianRepository from '@/server/guardian/repository';
import * as membersRepository from '@/server/members/repository';
import * as events from '@/server/visits/events';
import * as repository from '@/server/visits/repository';
import type { LibraryVisitWithRelations } from '@/server/visits/repository';
import {
  libraryVisitToJson,
  type ChildVisitStatusOut,
  type LibraryVisitOut,
  type MemberVisitStatusOut,
} from '@/server/visits/schemas';

// Mirrors backend/src/app/modules/visits/service.py.

// The member's presence state as implied by their latest visit row. Shared by
// getMemberStatus (which reads that row) and the check-in/check-out publishers (which
// already hold the row they just wrote) — two copies of this mapping would be two
// chances for the pushed status and the polled status to disagree.
function statusFromVisit(
  memberId: string,
  visit: LibraryVisitWithRelations | null,
): MemberVisitStatusOut {
  if (!visit) {
    return {
      member_id: memberId,
      is_in_library: false,
      checked_in_at: null,
      last_checked_out_at: null,
      latest_visit_id: null,
    };
  }

  const isInLibrary = visit.checkedOutAt === null;
  return {
    member_id: memberId,
    is_in_library: isInLibrary,
    checked_in_at: isInLibrary ? visit.checkedInAt.toISOString() : null,
    last_checked_out_at: visit.checkedOutAt?.toISOString() ?? null,
    latest_visit_id: visit.id,
  };
}

export async function checkInMember(
  recordedBy: AuthenticatedUser,
  memberId: string,
): Promise<LibraryVisitOut> {
  const member = await membersRepository.findById(memberId);
  if (!member || !member.isActive || member.deletedAt !== null) {
    throw new HttpError(404, 'Member not found or inactive');
  }

  const openVisit = await repository.findOpenVisitForMember(memberId);
  if (openVisit) throw new HttpError(400, 'Member is already checked in.');

  const visit = await repository.createCheckIn(memberId, recordedBy.id);
  // Staff scanned them in on the desk's device; the member's own dashboard has no way
  // to learn that happened until it asks again. Push it now — publishStatusChange
  // swallows Redis failures, so the 30s poll stays the safety net.
  await events.publishStatusChange(memberId, JSON.stringify(statusFromVisit(memberId, visit)));
  return libraryVisitToJson(visit);
}

export async function checkOutMember(
  recordedBy: AuthenticatedUser,
  memberId: string,
): Promise<LibraryVisitOut> {
  const member = await membersRepository.findById(memberId);
  if (!member) throw new HttpError(404, 'Member not found');

  const openVisit = await repository.findOpenVisitForMember(memberId);
  if (!openVisit) throw new HttpError(400, 'Member is not currently checked in.');

  const visit = await repository.closeVisit(openVisit.id);
  await events.publishStatusChange(memberId, JSON.stringify(statusFromVisit(memberId, visit)));
  return libraryVisitToJson(visit);
}

export async function listActiveVisits(): Promise<LibraryVisitOut[]> {
  const visits = await repository.listActiveVisits();
  return visits.map(libraryVisitToJson);
}

export async function getMemberStatus(user: AuthenticatedUser): Promise<MemberVisitStatusOut> {
  const latest = await repository.getLatestVisitForMember(user.id);
  return statusFromVisit(user.id, latest);
}

export async function getChildrenStatus(guardian: AuthenticatedUser): Promise<ChildVisitStatusOut[]> {
  const children = await guardianRepository.listChildren(guardian.id);
  const results: ChildVisitStatusOut[] = [];
  for (const child of children) {
    const latest = await repository.getLatestVisitForMember(child.id);
    if (!latest) {
      results.push({
        child_id: child.id,
        child_name: child.fullName,
        child_email: child.email,
        is_in_library: false,
        checked_in_at: null,
        last_checked_out_at: null,
      });
    } else {
      const isInLibrary = latest.checkedOutAt === null;
      results.push({
        child_id: child.id,
        child_name: child.fullName,
        child_email: child.email,
        is_in_library: isInLibrary,
        checked_in_at: isInLibrary ? latest.checkedInAt.toISOString() : null,
        last_checked_out_at: latest.checkedOutAt?.toISOString() ?? null,
      });
    }
  }
  return results;
}

function csvField(value: string): string {
  // Matches Python csv.writer's default quoting: quote only when needed (comma, quote,
  // or newline present), doubling any embedded quotes.
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function exportActiveVisitsCsv(): Promise<string> {
  const visits = await listActiveVisits();
  const header = ['Member ID', 'Member Name', 'Email', 'Check-In Date', 'Check-In Time', 'Status'];
  const lines = [header.join(',')];
  for (const visit of visits) {
    const dt = new Date(visit.checked_in_at);
    const dateStr = dt.toISOString().slice(0, 10);
    const timeStr = dt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
    lines.push(
      [
        visit.member_id,
        csvField(visit.member_name),
        visit.member_email,
        dateStr,
        timeStr,
        'Currently in Library',
      ]
        .map(csvField)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
