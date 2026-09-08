import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

import type { AuthenticatedUser } from '@/server/auth/guards';
import { buildChatLlm, logLlmFailure } from '@/server/llm';
import { checkInput, checkOutput, GuardrailBlock } from '@/server/chat/guardrails';
import { runWithChatUser } from '@/server/chat/context';
import { TOOLS } from '@/server/chat/tools';
import type { ChatMessage, ChatResponse } from '@/server/chat/schemas';

// Mirrors backend/src/app/modules/chat/orchestrator.py's run_chat + system prompt in
// full — a LangGraph ReAct agent with multi-LLM backend support (LLM_MODE, via
// @/server/llm — the same factory every other AI feature uses).
//
// Flow:
//   1. Input guardrails — checked before the LLM ever sees the message.
//   2. TAG + LLM — a LangGraph ReAct agent orchestrates the 27 tools in tools.ts.
//   3. Output guardrails, anti-hallucination retry, and markdown-list cleanup.
//
// RAG/FAQ is frontend-only (the unauthenticated conversation tree in
// frontend/src/lib/chatbot.ts) — chat/knowledge.py's RAG_KNOWLEDGE was never imported
// anywhere in the Python backend (confirmed by grep), so it isn't ported; same
// dead-code judgment call as books/events.py and seat_booking/events.py in phase 3.

function systemPrompt(userName: string, role: string, memberId: string): string {
  return `You are Shelfie, a helpful assistant for the Community Reading Club library platform.

Current user: ${userName} | Role: ${role} | ID: ${memberId}

Your job:
- Use the available tools to answer questions about books, loans, reservations, seat bookings, events, reading progress, notifications, support tickets, and membership plans.
- For staff roles (admin, librarian, manager, it_head): also use member search, loan management, and fine tools. Do NOT suggest or offer actions like registering for events, reserving books, or booking seats to staff users — those are member-only actions. Never ask a staff user "Would you like to register" for an event.
- ALWAYS call a tool to get live data. Never answer data questions from memory.
- The get_books tool returns a sample of up to 10 books — the library has hundreds. Never say 'here are all the books'. Always say 'here are some books' or 'here are a few books from our collection'.
- When a tool response includes a total_count field, always report that number as the actual total — never count the items in the sample and report that as the total.
- Resolve pronouns ("which one", "those", "it") from prior conversation turns before calling a tool.
- Only answer library-related questions. For anything else say: "I can only help with library-related topics."
- When the user asks to book a seat, ALWAYS call get_seat_availability first to get available seat labels and today's date, then call book_seat with a real seat label from that response.
- When the user asks to reserve a book by title, ALWAYS call get_books first to get the book_id, then call reserve_book with that id.
- When the user asks to register for an event by name, ALWAYS call get_upcoming_events first to get the event_id, then call register_for_event.
- When a tool returns one of these sentinel values, respond naturally without any bullet points:
  - empty_loans → "You haven't borrowed any books yet! Would you like to browse what's available or reserve a book?"
  - empty_reservations → "You don't have any active reservations. Would you like to reserve a book?"
  - empty_seat_bookings → "You don't have any seat bookings. Would you like to book a seat?"
  - empty_reading_progress → "No reading progress recorded yet. Start reading and track your progress here!"
- Be warm and conversational. When data is empty (no loans, no reservations, etc.), acknowledge it naturally and offer ONE relevant next step only (e.g. if no loans → suggest reserving a book; if no reservations → suggest browsing books; if no seat bookings → suggest booking a seat).
- Never suggest actions that contradict the data (e.g. do NOT suggest returning a loan if the user has no loans).
- Never render an empty bullet point. If there is no list data, just write a sentence.
- When showing seat bookings, NEVER display the booking_id to the user — use it internally only when calling cancel_seat_booking.
- When showing seat bookings, do NOT proactively offer to cancel them. Only attempt cancellation if the user explicitly asks.
- Use markdown lists (each item on its own line starting with \`- \`) for any list of results. Each list item must be on its own line — never put multiple items on the same line separated by bullets or commas.
- Always put a blank line between an intro sentence and a list.
- Use **bold** for titles and key values. Keep responses concise.
- Never mix list styles — use only \`- \` prefixed items, never \`•\` or \`*\` or numbered inline.`;
}

const DATA_QUESTION_KEYWORDS = [
  'recommend',
  'suggest',
  'what should i read',
  'best book',
  'top book',
  'highest rated',
  'popular book',
  'what to read',
];

const TAG_KEYWORDS = [
  'event',
  'book',
  'member',
  'progress',
  'reading',
  'show',
  'list',
  'loan',
  'reservation',
  'seat',
  'fine',
  'ticket',
  'leaderboard',
  'streak',
  'goal',
  'notification',
  'plan',
  'reserve',
  'register',
  'cancel',
  'return',
  'remind',
];

// Some smaller models (llama3.2, nova-lite) ignore the system prompt's formatting rules
// and emit "• item • item" in one paragraph instead of a real markdown list.
function normalizeBullets(text: string): string {
  if (!text.includes('•')) return text;
  const parts = text
    .split('•')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return text;
  const introIsListItem = parts[0].startsWith('-') || parts[0].startsWith('*');
  const intro = introIsListItem ? '' : parts[0];
  const items = intro ? parts.slice(1) : parts;
  return (intro ? `${intro}\n\n` : '') + items.map((i) => `- ${i}`).join('\n');
}

// Normalises numbered lists without newlines: "1. foo 2. bar" → proper markdown.
function normalizeNumberedLists(text: string): string {
  if (!/\d+\.\s.+\d+\.\s/.test(text)) return text;
  return text.replace(/(?<=[^\n])(\d+\.\s)/g, '\n$1').trim();
}

export async function runChat(opts: {
  message: string;
  history: ChatMessage[];
  user: AuthenticatedUser;
}): Promise<ChatResponse> {
  const { message, history, user } = opts;
  const memberId = user.id;
  const role = user.role.name;
  const userName = user.fullName;

  // 1. Input guardrails.
  let safeMessage: string;
  try {
    safeMessage = checkInput(message);
  } catch (block) {
    if (block instanceof GuardrailBlock) return { reply: block.reply, source: 'rag' };
    throw block;
  }

  // 2. TAG + LLM via LangGraph ReAct agent.
  let llm;
  try {
    llm = await buildChatLlm();
  } catch (exc) {
    logLlmFailure('run_chat(build_chat_llm)', exc, { member_id: memberId });
    return { reply: 'The assistant is unavailable right now. Please try again shortly.', source: 'error' };
  }

  const agent = createReactAgent({ llm, tools: TOOLS });

  const msgs: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(systemPrompt(userName, role, memberId)),
  ];
  for (const h of history.slice(-10)) {
    msgs.push(h.role === 'user' ? new HumanMessage(h.content) : new AIMessage(h.content));
  }
  msgs.push(new HumanMessage(safeMessage));

  try {
    const runAgent = () => runWithChatUser(user, () => agent.invoke({ messages: msgs }));

    const result = await runAgent();
    let final = String(result.messages[result.messages.length - 1].content);
    final = checkOutput(final);

    // Anti-hallucination: if the LLM answered a book/event/data question without
    // calling any tool, force it to use the tool instead.
    const toolWasCalled = result.messages.some((m: { type?: string }) => m.type === 'tool');
    const lowerMessage = message.toLowerCase();
    const isDataQuestion = DATA_QUESTION_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    if (isDataQuestion && !toolWasCalled) {
      msgs.push(new AIMessage(final));
      msgs.push(
        new HumanMessage(
          "Use the get_books tool with sort='recommended' to answer the previous question. Do not answer from memory.",
        ),
      );
      const result2 = await runWithChatUser(user, () => agent.invoke({ messages: msgs }));
      final = checkOutput(String(result2.messages[result2.messages.length - 1].content));
    }

    final = normalizeBullets(final);
    final = normalizeNumberedLists(final);

    const isTag = TAG_KEYWORDS.some((kw) => lowerMessage.includes(kw));
    return { reply: final, source: isTag ? 'tag' : 'llm' };
  } catch (exc) {
    logLlmFailure('run_chat(agent.invoke)', exc, { member_id: memberId, message: message.slice(0, 120) });
    return { reply: 'Something went wrong handling that. Please try again.', source: 'error' };
  }
}
