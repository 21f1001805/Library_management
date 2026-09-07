/**
 * Subscribes to a backend Server-Sent-Events stream via fetch() rather than the native
 * EventSource API — EventSource can't attach an Authorization header, and every other
 * authenticated request in this app already goes through a Bearer token, not a cookie.
 *
 * Returns an unsubscribe function. Reconnects automatically (matching EventSource's own
 * default behavior) if the connection drops for any reason other than the caller
 * unsubscribing.
 */
export function subscribeToSSE(
  url: string,
  token: string,
  onMessage: (data: string) => void,
  onError?: () => void,
): () => void {
  const controller = new AbortController();
  const RECONNECT_DELAY_MS = 3000;

  async function connect() {
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE request failed: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
            if (dataLine) onMessage(dataLine.slice('data: '.length));
          }
        }
      } catch {
        // Aborted by the caller (unsubscribe) — not a real failure, don't reconnect.
        if (controller.signal.aborted) return;
        onError?.();
      }
      if (controller.signal.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
  }

  void connect();
  return () => controller.abort();
}
