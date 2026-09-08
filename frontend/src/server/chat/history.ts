import Redis from 'ioredis';

import { env } from '@/server/env';
import type { ChatMessage } from '@/server/chat/schemas';

// Mirrors backend/src/app/modules/chat/history.py. Redis-backed chat history store.
//
// Each user gets a Redis list key: chat:history:<member_id>
// Each entry is a JSON object: {"role": "user"|"assistant", "content": "..."}
//
// Only the last CHAT_HISTORY_MAX_TURNS turn-pairs (user + assistant = 1 turn) are kept.
// The key expires after CHAT_HISTORY_TTL_SECONDS of inactivity, resetting on every write.

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL);
    redis.on('error', (err) => console.error('chat history Redis client error:', err));
  }
  return redis;
}

function key(memberId: string): string {
  return `chat:history:${memberId}`;
}

// Returns the last CHAT_HISTORY_MAX_TURNS * 2 messages (user + assistant pairs).
export async function loadHistory(memberId: string): Promise<ChatMessage[]> {
  const raw = await getRedis().lrange(key(memberId), 0, -1);
  const messages: ChatMessage[] = raw.map((item) => JSON.parse(item));
  const limit = env.CHAT_HISTORY_MAX_TURNS * 2;
  return messages.length > limit ? messages.slice(-limit) : messages;
}

// Appends a user+assistant turn and resets the TTL.
export async function appendTurn(memberId: string, userMsg: string, assistantMsg: string): Promise<void> {
  const k = key(memberId);
  const limit = env.CHAT_HISTORY_MAX_TURNS * 2;

  const pipeline = getRedis().pipeline();
  pipeline.rpush(k, JSON.stringify({ role: 'user', content: userMsg }));
  pipeline.rpush(k, JSON.stringify({ role: 'assistant', content: assistantMsg }));
  // Trim to max_turns * 2 messages from the right (most recent).
  pipeline.ltrim(k, -limit, -1);
  pipeline.expire(k, env.CHAT_HISTORY_TTL_SECONDS);
  await pipeline.exec();
}

// Deletes the conversation history for a user.
export async function clearHistory(memberId: string): Promise<void> {
  await getRedis().del(key(memberId));
}
