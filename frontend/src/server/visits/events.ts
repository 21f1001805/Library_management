import { getRedisPublisher } from '@/server/sse';

// Mirrors backend/src/app/modules/visits/events.py's publish side — subscribe is
// handled generically by server/sse.ts's sseResponseForChannel.
function channel(memberId: string): string {
  return `visits:status:${memberId}`;
}

export async function publishStatusChange(memberId: string, payloadJson: string): Promise<void> {
  try {
    await getRedisPublisher().publish(channel(memberId), payloadJson);
  } catch (err) {
    console.error(`Failed to publish visit status change for member ${memberId}:`, err);
  }
}

export function visitStatusChannel(memberId: string): string {
  return channel(memberId);
}
