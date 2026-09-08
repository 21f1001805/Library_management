import { getRedisPublisher } from '@/server/sse';

// Mirrors backend/src/app/modules/reservations/events.py. Per-member channels, not one
// global one: a reservation belongs to exactly one member. Publishes a bare signal
// rather than the new state — list_my_reservations recomputes queue position/ETA
// against *other* members' activity, so a payload built at publish time would be stale
// for anyone but the one member whose row changed; subscribers just refetch.
function channel(memberId: string): string {
  return `reservations:member:${memberId}`;
}

export async function publishReservationsChanged(memberId: string): Promise<void> {
  try {
    await getRedisPublisher().publish(channel(memberId), 'changed');
  } catch (err) {
    console.error(`Failed to publish reservation change for member ${memberId}:`, err);
  }
}

export function reservationChannel(memberId: string): string {
  return channel(memberId);
}
