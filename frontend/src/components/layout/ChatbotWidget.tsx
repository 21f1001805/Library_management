import { AnimatePresence, motion } from 'framer-motion';
import { Bot, RotateCcw, Send, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { apiPost, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/providers/AuthProvider';
import { CONVERSATION_TREE, type TreeNode } from '@/lib/chatbot';

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
  source?: 'rag' | 'tag' | 'llm' | 'error';
}

interface ChatApiResponse {
  reply: string;
  source: 'rag' | 'tag' | 'llm' | 'error';
}

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

// Role-specific quick-action chips shown after login
const ROLE_CHIPS: Record<string, string[]> = {
  member: [
    'What events are coming up?',
    'Show me available books',
    'What is my reading progress?',
    'How do I reserve a book?',
    'How do I book a seat?',
  ],
  guardian: [
    'What events are coming up?',
    'Show me available books',
    'How do I pay a fine?',
    'How do I book a seat for my child?',
  ],
  librarian: [
    'Show me available books',
    'Search for a member',
    'What events are coming up?',
    'How do I issue a book?',
  ],
  manager: [
    'How many members do we have?',
    'What events are coming up?',
    'Show me available books',
    'How do I register a new member?',
  ],
  admin: [
    'How many members do we have?',
    'What events are coming up?',
    'Show me all books',
    'Search for a member by name',
  ],
  'it-head': [
    'How many members do we have?',
    'What events are coming up?',
    'Show me available books',
  ],
};

export function ChatbotWidget() {
  const { t } = useTranslation();
  const headingId = useId();
  const { isAuthenticated, role, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Landing (unauthenticated) state — tree navigation
  const [currentNode, setCurrentNode] = useState<TreeNode>(CONVERSATION_TREE['root']);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 'greeting', from: 'bot', text: t('chatbot.greeting') },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when auth state changes
  useEffect(() => {
    const greeting = t('chatbot.greeting');
    if (isAuthenticated && role) {
      const chips = ROLE_CHIPS[role] ?? ROLE_CHIPS['member'];
      setMessages([
        { id: 'greeting', from: 'bot', text: greeting },
        {
          id: 'role-intro',
          from: 'bot',
          text: `I can help you with live data or any questions. Try one of the suggestions below, or just type anything!`,
        },
      ]);
      // store chips as a synthetic node so we can render them
      setCurrentNode({ id: 'role-root', botMessage: '', options: chips.map(c => ({ label: c, nextId: '__llm__' })) });
    } else {
      setMessages([
        { id: 'greeting', from: 'bot', text: greeting },
        { id: 'root', from: 'bot', text: CONVERSATION_TREE['root'].botMessage },
      ]);
      setCurrentNode(CONVERSATION_TREE['root']);
    }
    setHistory([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, role]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open && isAuthenticated) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open, isAuthenticated]);

  // ── Authenticated: send to LLM backend ───────────────────────────────────
  async function sendToLLM(text: string) {
    if (!token || !text.trim()) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), from: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const newHistory: HistoryEntry[] = [...history, { role: 'user', content: text }];

    try {
      const res = await apiPost<ChatApiResponse>(
        '/chat',
        { message: text, history },
        token,
      );
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        from: 'bot',
        text: res.reply,
        source: res.source,
      };
      setMessages(prev => [...prev, botMsg]);
      setHistory([...newHistory, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          from: 'bot',
          text: getErrorMessage(err, 'Something went wrong. Please try again.'),
          source: 'error',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── Unauthenticated: tree navigation ─────────────────────────────────────
  function selectTreeOption(label: string, nextId: string) {
    if (isAuthenticated) {
      void sendToLLM(label);
      return;
    }
    const next = CONVERSATION_TREE[nextId];
    if (!next) return;
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), from: 'user', text: label },
      { id: crypto.randomUUID(), from: 'bot', text: next.botMessage },
    ]);
    setCurrentNode(next);
  }

  function handleReset() {
    if (isAuthenticated && role) {
      const chips = ROLE_CHIPS[role] ?? ROLE_CHIPS['member'];
      setMessages([
        { id: 'greeting', from: 'bot', text: t('chatbot.greeting') },
        { id: 'role-intro', from: 'bot', text: 'Try one of the suggestions below, or just type anything!' },
      ]);
      setCurrentNode({ id: 'role-root', botMessage: '', options: chips.map(c => ({ label: c, nextId: '__llm__' })) });
    } else {
      setMessages([
        { id: 'greeting', from: 'bot', text: t('chatbot.greeting') },
        { id: 'root', from: 'bot', text: CONVERSATION_TREE['root'].botMessage },
      ]);
      setCurrentNode(CONVERSATION_TREE['root']);
    }
    setHistory([]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendToLLM(input);
    }
  }

  const showOptions = !loading && currentNode.options && currentNode.options.length > 0;
  const showBackButton = !isAuthenticated && !loading && (!currentNode.options || currentNode.options.length === 0);

  const sourceLabel: Record<string, string> = { rag: 'FAQ', tag: 'Live data', llm: 'AI' };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby={headingId}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto flex w-80 flex-col overflow-hidden rounded-2xl border border-border shadow-2xl sm:w-96"
            style={{ height: 540 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-primary/80 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                    <Bot className="size-5" />
                  </span>
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-green-400" />
                </div>
                <div>
                  <p id={headingId} className="text-sm font-semibold text-white">{t('chatbot.title')}</p>
                  <p className="text-[11px] text-white/70">
                    {isAuthenticated ? `${role} · AI-powered` : 'Library Assistant'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleReset} aria-label="Reset chat" className="flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white">
                  <RotateCcw className="size-4" />
                </button>
                <button onClick={() => setOpen(false)} aria-label={t('chatbot.closeChat')} className="flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-surface p-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cn('flex items-end gap-2', msg.from === 'user' && 'flex-row-reverse')}
                  >
                    {msg.from === 'bot' && (
                      <span className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="size-3.5" />
                      </span>
                    )}
                    <div className={cn('flex max-w-[78%] flex-col gap-1', msg.from === 'user' && 'items-end')}>
                      <p className={cn(
                        'whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                        msg.from === 'bot'
                          ? 'rounded-bl-sm bg-secondary text-foreground'
                          : 'rounded-br-sm bg-primary text-primary-foreground',
                      )}>
                        {msg.text}
                      </p>
                      {msg.source && msg.from === 'bot' && sourceLabel[msg.source] && (
                        <span className="px-1 text-[10px] text-muted-foreground">
                          {sourceLabel[msg.source]}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {loading && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2">
                  <span className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-3.5" />
                  </span>
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-secondary px-4 py-3 shadow-sm">
                    {[0, 1, 2].map((dot) => (
                      <span key={dot} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${dot * 0.15}s` }} />
                    ))}
                  </span>
                </motion.div>
              )}

              {/* Option chips */}
              {showOptions && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1.5 pt-1">
                  {(currentNode.options ?? []).map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => selectTreeOption(option.label, option.nextId)}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-left text-sm text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Back button for tree leaf nodes (unauthenticated only) */}
              {showBackButton && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-1">
                  <button type="button" onClick={handleReset} className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/10 active:scale-[0.98]">
                    Back to topics
                  </button>
                </motion.div>
              )}
            </div>

            {/* Input — only shown when authenticated */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything…"
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!input.trim() || loading}
                  onClick={() => void sendToLLM(input)}
                  className="size-8 shrink-0 rounded-full p-0"
                  aria-label="Send"
                >
                  <Send className="size-3.5" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <div className="pointer-events-auto relative">
        {!open && <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-20" />}
        <Button
          variant="primary"
          onClick={() => setOpen((v) => !v)}
          aria-label={t(open ? 'chatbot.closeChat' : 'chatbot.openChat')}
          className="relative size-14 rounded-full p-0 shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? 'close' : 'bot'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              {open ? <X className="size-5" /> : <Bot className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}
