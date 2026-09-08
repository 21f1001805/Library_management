import Redis from 'ioredis';

import { env } from '@/server/env';

// Shared regular client for publish() calls across every events module — one connection
// is fine for a bunch of independent publishes. Subscribing needs its own dedicated
// connection per active stream (ioredis enters exclusive subscriber mode on a
// connection once you call .subscribe()), created via duplicate() below.
let publisher: Redis | null = null;
export function getRedisPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL);
    publisher.on('error', (err) => console.error('Redis publisher error:', err));
  }
  return publisher;
}

const KEEPALIVE_MS = 15_000;

// Builds an SSE Response subscribed to one Redis channel — mirrors the
// StreamingResponse(media_type="text/event-stream") pattern used by reservations/visits
// routers. `formatMessage` turns a raw Redis message into the full "data: ...\n\n" SSE
// frame; the caller decides the payload shape (a bare "changed" signal vs real JSON).
//
// Sends a keep-alive comment on a fixed interval rather than only after N seconds of
// silence (the Python version's exact semantics) — simpler, and functionally equivalent
// for the one thing the keep-alive is for: stopping a proxy/load balancer from timing
// out an idle connection.
export function sseResponseForChannel(
  request: Request,
  channel: string,
  formatMessage: (message: string) => string,
): Response {
  const subscriber = getRedisPublisher().duplicate();
  let closed = false;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const close = () => {
        if (closed) return;
        closed = true;
        if (keepalive) clearInterval(keepalive);
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          // Already closed by the consumer disconnecting — nothing left to do.
        }
      };

      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          close();
        }
      }, KEEPALIVE_MS);

      subscriber.on('message', (_channel, message) => {
        try {
          controller.enqueue(encoder.encode(formatMessage(message)));
        } catch {
          close();
        }
      });

      subscriber.subscribe(channel).catch((err: unknown) => {
        console.error(`Failed to subscribe to ${channel}:`, err);
        close();
      });

      request.signal.addEventListener('abort', close);
    },
    cancel() {
      closed = true;
      if (keepalive) clearInterval(keepalive);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
