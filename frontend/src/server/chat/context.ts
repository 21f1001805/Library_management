import { AsyncLocalStorage } from 'node:async_hooks';

import type { AuthenticatedUser } from '@/server/auth/guards';

// Mirrors orchestrator.py's per-request ContextVar. Tools read this while the agent is
// suspended at an await, so with a plain module-level variable a concurrent request
// would overwrite it and the suspended request's tools would resume reading the *other*
// caller's user — a cross-user data leak, and a privilege escalation through the
// STAFF_ROLES checks in tools.ts. AsyncLocalStorage is Node's per-async-task equivalent
// of Python's ContextVar: each call to runWithChatUser gets its own isolated store that
// survives every await inside `fn`, without leaking into a concurrent request's tasks.
const storage = new AsyncLocalStorage<AuthenticatedUser>();

export function runWithChatUser<T>(user: AuthenticatedUser, fn: () => Promise<T>): Promise<T> {
  return storage.run(user, fn);
}

// Throws rather than returning a fallback if called outside a chat request — every tool
// call happens inside the agent invocation runWithChatUser wraps, so a missing store
// means a real wiring bug, not a legitimate "no user" case worth degrading gracefully.
export function currentChatUser(): AuthenticatedUser {
  const user = storage.getStore();
  if (!user) throw new Error('chat tool invoked outside of a chat request context');
  return user;
}
