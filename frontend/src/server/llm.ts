// Mirrors backend/src/app/core/llm.py — shared chat/embedding-model factories for every
// feature that calls the configured LLM backend. Same LLM_MODE branch (openai | bedrock
// | ollama) as the Python side, using LangChain.js's equivalent packages so this and the
// phase-8 chat agent share one abstraction layer, same as the Python backend does.
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';
import type { Serialized } from '@langchain/core/load/serializable';

import { env } from '@/server/env';

// Prompts and replies go into the log verbatim under LLM_DEBUG, so cap them — a book
// description or a 30-book tool result would otherwise bury every other line.
const PREVIEW_LIMIT = 400;

function preview(value: unknown, limit = PREVIEW_LIMIT): string {
  const text = String(value).split(/\s+/).join(' ');
  return text.length <= limit ? text : `${text.slice(0, limit)}…(+${text.length - limit} chars)`;
}

function logResolved(kind: string, mode: string, details: Record<string, unknown>): void {
  const detailStr = Object.entries(details)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.info(`${kind}: mode=${mode} ${detailStr}`);
}

// ── Failure diagnosis ─────────────────────────────────────────────────────────
// Every provider reports failures as a deeply-nested exception whose useful part is
// buried. These matchers pull the cause back to the front of the message.
// Classification is by exception name/message text (not by importing each provider's
// SDK error types), so this keeps working when only one provider's package is used.
export function describeLlmError(exc: unknown): string {
  const err = exc instanceof Error ? exc : new Error(String(exc));
  const name = err.name || 'Error';
  const text = err.message;
  const lowered = text.toLowerCase();

  // AWS Bedrock — the AWS SDK throws one exception class per modeled error code, so the
  // class name *is* the error code.
  if (['ExpiredTokenException', 'InvalidSignatureException'].includes(name) || lowered.includes('expired')) {
    return (
      `${name}: AWS credentials are expired or invalid — refresh them ` +
      '(aws sso login, or update AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in .env)'
    );
  }
  if (['NoCredentialsError', 'PartialCredentialsError', 'UnrecognizedClientException'].includes(name)) {
    return (
      `${name}: no usable AWS credentials found — set AWS_ACCESS_KEY_ID and ` +
      'AWS_SECRET_ACCESS_KEY in .env, or configure a profile with aws configure'
    );
  }
  if (name === 'AccessDeniedException') {
    return (
      `${name}: the AWS identity is authenticated but not allowed to invoke this ` +
      'model — enable model access for it in the Bedrock console (Model access) and ' +
      `allow bedrock:InvokeModel in the IAM policy. AWS said: ${text}`
    );
  }
  if (name === 'ValidationException') {
    return (
      `${name}: Bedrock rejected the request — usually BEDROCK_MODEL_ID is not valid ` +
      'for AWS_REGION, or the model needs its cross-region inference-profile id (the ' +
      `us. prefix) rather than the bare foundation-model id. AWS said: ${text}`
    );
  }
  if (name === 'ResourceNotFoundException') {
    return (
      `${name}: no such model in this region — check BEDROCK_MODEL_ID against ` +
      `AWS_REGION. AWS said: ${text}`
    );
  }
  if (['ThrottlingException', 'TooManyRequestsException', 'ServiceQuotaExceededException'].includes(name)) {
    return `${name}: Bedrock is throttling this account — retry with backoff. AWS said: ${text}`;
  }
  if (['EndpointConnectionError', 'ConnectTimeoutError'].includes(name)) {
    return `${name}: could not reach the Bedrock endpoint — check network and AWS_REGION`;
  }

  // Ollama — a local daemon, so the two failures are "not running" and "not pulled".
  if (['ConnectError', 'ConnectionError'].includes(name) || lowered.includes('connection refused') || lowered.includes('econnrefused')) {
    return (
      `${name}: cannot reach the Ollama server at OLLAMA_BASE_URL — start it with ` +
      `ollama serve, or correct OLLAMA_BASE_URL. Original: ${text}`
    );
  }
  if (lowered.includes('not found') && (lowered.includes('model') || lowered.includes('pull'))) {
    return (
      `${name}: Ollama does not have that model locally — run ollama pull for the ` +
      `name in OLLAMA_MODEL / OLLAMA_EMBEDDING_MODEL. Original: ${text}`
    );
  }
  if (lowered.includes('timeout') || ['ReadTimeout', 'ConnectTimeout'].includes(name)) {
    return (
      `${name}: the model backend timed out — a cold Ollama model load can exceed the ` +
      `client timeout; retry once the model is resident. Original: ${text}`
    );
  }

  // OpenAI
  if (['AuthenticationError', 'PermissionDeniedError'].includes(name)) {
    return `${name}: OPENAI_API_KEY is missing, wrong, or lacks access. Original: ${text}`;
  }
  if (name === 'RateLimitError') {
    return `${name}: OpenAI rate limit or quota exhausted. Original: ${text}`;
  }

  return `${name}: ${text}`;
}

// Call sites deliberately swallow LLM errors — a missing book embedding or an
// unavailable review digest degrades gracefully rather than failing the request —
// which is the right behavior but leaves the log as the *only* evidence the feature is
// broken. This makes that evidence say why on the first line instead of the last.
export function logLlmFailure(where: string, exc: unknown, context: Record<string, unknown> = {}): void {
  const detailStr = Object.entries(context)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.error(
    `${where} failed [mode=${env.LLM_MODE.toLowerCase()} ${detailStr}]: ${describeLlmError(exc)}`,
    exc,
  );
}

// ── Per-call tracing (LLM_DEBUG=true) ─────────────────────────────────────────
// Logs each model turn and tool call, with latency. Attached at construction so it
// also covers a ReAct agent's *internal* turns (phase 8) — a call site's own try/catch
// only ever sees the final exception, which hides both "the model answered without
// calling any tool" and "the model looped three times".
class LlmDebugCallback extends BaseCallbackHandler {
  name = 'LlmDebugCallback';
  private mode: string;
  private model: string;
  // Keyed by LangChain's per-invocation runId; entries are popped on end/error, so
  // this only ever holds the runs currently in flight.
  private started = new Map<string, number>();

  constructor(mode: string, model: string) {
    super();
    this.mode = mode;
    this.model = model;
  }

  private begin(runId: string): void {
    this.started.set(runId, Date.now());
  }

  private elapsedMs(runId: string): number {
    const start = this.started.get(runId);
    this.started.delete(runId);
    return start !== undefined ? Date.now() - start : -1;
  }

  handleChatModelStart(_llm: Serialized, messages: BaseMessage[][], runId: string): void {
    this.begin(runId);
    const turn = messages[0] ?? [];
    const last = turn[turn.length - 1];
    console.debug(
      `llm.request: mode=${this.mode} model=${this.model} messages=${turn.length} last=${preview(last?.content ?? '')}`,
    );
  }

  handleLLMStart(_llm: Serialized, prompts: string[], runId: string): void {
    this.begin(runId);
    console.debug(
      `llm.request: mode=${this.mode} model=${this.model} prompts=${prompts.length} first=${preview(prompts[0] ?? '')}`,
    );
  }

  handleLLMEnd(output: LLMResult, runId: string): void {
    let text = '';
    let toolCalls: string[] = [];
    let usage: unknown;
    try {
      const generation = output.generations[0]?.[0] as
        | { text?: string; message?: { tool_calls?: { name: string }[]; usage_metadata?: unknown } }
        | undefined;
      text = generation?.text ?? '';
      toolCalls = (generation?.message?.tool_calls ?? []).map((c) => c.name);
      usage = generation?.message?.usage_metadata;
    } catch {
      // Shape varies by provider — best-effort only, never worth failing the log line.
    }
    console.info(
      `llm.response: mode=${this.mode} model=${this.model} elapsed_ms=${this.elapsedMs(runId).toFixed(0)} ` +
        `tool_calls=${toolCalls.length ? toolCalls.join(',') : 'none'} tokens=${usage ?? 'n/a'} reply=${preview(text)}`,
    );
  }

  handleLLMError(err: Error, runId: string): void {
    console.error(
      `llm.error: mode=${this.mode} model=${this.model} elapsed_ms=${this.elapsedMs(runId).toFixed(0)} — ${describeLlmError(err)}`,
    );
  }

  handleToolStart(tool: Serialized, inputStr: string, runId: string): void {
    this.begin(runId);
    const toolName = (tool as unknown as { name?: string })?.name ?? '?';
    console.debug(`tool.request: name=${toolName} args=${preview(inputStr)}`);
  }

  handleToolEnd(output: unknown, runId: string): void {
    console.debug(`tool.response: elapsed_ms=${this.elapsedMs(runId).toFixed(0)} result=${preview(output)}`);
  }

  handleToolError(err: Error, runId: string): void {
    console.error(`tool.error: elapsed_ms=${this.elapsedMs(runId).toFixed(0)} — ${err.name}: ${err.message}`);
  }
}

// Attached only when LLM_DEBUG=true — the handler logs prompts and replies verbatim,
// which is what you want while diagnosing and not what you want in a production log.
// Failures are reported either way, by logLlmFailure at the call sites.
function debugCallbacks(mode: string, model: string): BaseCallbackHandler[] {
  return env.LLM_DEBUG ? [new LlmDebugCallback(mode, model)] : [];
}

export async function buildChatLlm(): Promise<BaseChatModel> {
  const mode = env.LLM_MODE.toLowerCase();

  if (mode === 'bedrock') {
    const { ChatBedrockConverse } = await import('@langchain/aws');
    const hasCreds = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
    logResolved('buildChatLlm', mode, {
      model_id: env.BEDROCK_MODEL_ID,
      region: env.AWS_REGION,
      explicit_credentials: hasCreds,
    });
    try {
      return new ChatBedrockConverse({
        model: env.BEDROCK_MODEL_ID,
        region: env.AWS_REGION,
        callbacks: debugCallbacks(mode, env.BEDROCK_MODEL_ID),
        ...(hasCreds
          ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } }
          : {}),
      });
    } catch (exc) {
      logLlmFailure('buildChatLlm(ChatBedrockConverse)', exc, {
        model_id: env.BEDROCK_MODEL_ID,
        region: env.AWS_REGION,
      });
      throw exc;
    }
  }

  if (mode === 'ollama') {
    const { ChatOllama } = await import('@langchain/ollama');
    logResolved('buildChatLlm', mode, { model: env.OLLAMA_MODEL, base_url: env.OLLAMA_BASE_URL });
    try {
      return new ChatOllama({
        model: env.OLLAMA_MODEL,
        baseUrl: env.OLLAMA_BASE_URL,
        callbacks: debugCallbacks(mode, env.OLLAMA_MODEL),
      });
    } catch (exc) {
      logLlmFailure('buildChatLlm(ChatOllama)', exc, { model: env.OLLAMA_MODEL, base_url: env.OLLAMA_BASE_URL });
      throw exc;
    }
  }

  const { ChatOpenAI } = await import('@langchain/openai');
  logResolved('buildChatLlm', mode, { model: env.OPENAI_MODEL, has_api_key: Boolean(env.OPENAI_API_KEY) });
  try {
    return new ChatOpenAI({
      model: env.OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      temperature: 0.3,
      callbacks: debugCallbacks(mode, env.OPENAI_MODEL),
    });
  } catch (exc) {
    logLlmFailure('buildChatLlm(ChatOpenAI)', exc, { model: env.OPENAI_MODEL });
    throw exc;
  }
}

// Same LLM_MODE branch as buildChatLlm(), for the features that need vectors instead of
// text (book similarity). Kept as a separate factory rather than a second branch inside
// buildChatLlm() — a chat model and an embedding model are different LangChain
// interfaces. The embedding model is configured *separately* from the chat model on
// every provider, and chat working says nothing about embeddings working — check the
// log for buildEmbeddings if related-books quietly returns nothing while chat is fine.
export async function buildEmbeddings(): Promise<Embeddings> {
  const mode = env.LLM_MODE.toLowerCase();

  if (mode === 'bedrock') {
    const { BedrockEmbeddings } = await import('@langchain/aws');
    const hasCreds = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
    logResolved('buildEmbeddings', mode, {
      model_id: env.BEDROCK_EMBEDDING_MODEL_ID,
      region: env.AWS_REGION,
      explicit_credentials: hasCreds,
    });
    try {
      return new BedrockEmbeddings({
        model: env.BEDROCK_EMBEDDING_MODEL_ID,
        region: env.AWS_REGION,
        ...(hasCreds
          ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } }
          : {}),
      });
    } catch (exc) {
      logLlmFailure('buildEmbeddings(BedrockEmbeddings)', exc, {
        model_id: env.BEDROCK_EMBEDDING_MODEL_ID,
        region: env.AWS_REGION,
      });
      throw exc;
    }
  }

  if (mode === 'ollama') {
    const { OllamaEmbeddings } = await import('@langchain/ollama');
    logResolved('buildEmbeddings', mode, { model: env.OLLAMA_EMBEDDING_MODEL, base_url: env.OLLAMA_BASE_URL });
    try {
      return new OllamaEmbeddings({ model: env.OLLAMA_EMBEDDING_MODEL, baseUrl: env.OLLAMA_BASE_URL });
    } catch (exc) {
      logLlmFailure('buildEmbeddings(OllamaEmbeddings)', exc, {
        model: env.OLLAMA_EMBEDDING_MODEL,
        base_url: env.OLLAMA_BASE_URL,
      });
      throw exc;
    }
  }

  const { OpenAIEmbeddings } = await import('@langchain/openai');
  logResolved('buildEmbeddings', mode, {
    model: env.OPENAI_EMBEDDING_MODEL,
    has_api_key: Boolean(env.OPENAI_API_KEY),
  });
  try {
    return new OpenAIEmbeddings({ model: env.OPENAI_EMBEDDING_MODEL, apiKey: env.OPENAI_API_KEY });
  } catch (exc) {
    logLlmFailure('buildEmbeddings(OpenAIEmbeddings)', exc, { model: env.OPENAI_EMBEDDING_MODEL });
    throw exc;
  }
}

// Small local models sometimes wrap a requested JSON reply in a markdown code fence
// despite being told not to — strip one if present before parsing. Shared by every
// feature that asks the model for structured output instead of prose.
export function extractJsonObject(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/`/g, '');
    if (cleaned.toLowerCase().startsWith('json')) {
      cleaned = cleaned.slice(4);
    }
    cleaned = cleaned.trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Callers only see null, which looks identical to "the backend is down" — log the
    // reply that failed to parse so a prompt-adherence problem is distinguishable from
    // a transport one.
    console.warn(`extractJsonObject: reply was not valid JSON: ${preview(text)}`);
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.warn(`extractJsonObject: expected a JSON object, got ${typeof parsed}`);
    return null;
  }
  return parsed as Record<string, unknown>;
}
