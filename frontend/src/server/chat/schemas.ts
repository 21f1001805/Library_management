import { z } from 'zod';

// Mirrors backend/src/app/modules/chat/schemas.py.

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
});
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

export interface ChatResponse {
  reply: string;
  source: 'rag' | 'tag' | 'llm' | 'error';
}
