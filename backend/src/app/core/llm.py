"""Shared chat/embedding-model factories for every feature that calls the configured LLM
backend.

LLM_MODE (set in .env):
  openai  -> ChatOpenAI (gpt-4o-mini or OPENAI_MODEL) / OpenAIEmbeddings
  bedrock -> ChatBedrockConverse (amazon.nova-lite-v1:0 or BEDROCK_MODEL_ID) / BedrockEmbeddings
  ollama  -> ChatOllama (llama3.2:3b or OLLAMA_MODEL) / OllamaEmbeddings

Pulled out of chat/orchestrator.py once a second feature (books/service.py's
suggest_description) needed the same provider-selection logic — one place to add a
provider or change a default, instead of two copies drifting apart.

Debugging a "the LLM isn't working" report: every provider failure ends up at
describe_llm_error() below, which turns the provider's own exception into one readable
line naming the actual cause (expired SSO token, model not enabled in this region,
Ollama not running, model not pulled). Set LLM_DEBUG=true in .env to also log every
model turn and tool call with latency and truncated payloads. For a one-shot check of
whichever backend is configured, run `python scripts/check_llm.py` — it exercises chat
and embeddings and prints the same diagnosis without needing a request to come through
the API first.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from pydantic import SecretStr

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Prompts and replies go into the log verbatim under LLM_DEBUG, so cap them — a book
# description or a 30-book tool result would otherwise bury every other line.
_PREVIEW_LIMIT = 400


def _preview(value: object, limit: int = _PREVIEW_LIMIT) -> str:
    text = " ".join(str(value).split())
    return text if len(text) <= limit else text[:limit] + f"…(+{len(text) - limit} chars)"


# get_settings() is @lru_cache'd — whatever LLM_MODE was in .env at the moment the
# process first called it is what every call gets for the rest of that process's life.
# Editing .env while the app is already running does NOT change this until the process
# restarts (uvicorn --reload watches .py files, not .env). Logging the resolved mode on
# every call makes that mismatch visible immediately instead of needing to diff .env's
# mtime against the process start time to figure out why "the mode I just set" isn't
# the mode actually being used.
def _log_resolved(kind: str, mode: str, **details: object) -> None:
    detail_str = " ".join(f"{k}={v}" for k, v in details.items())
    logger.info("%s: mode=%s %s", kind, mode, detail_str)


# ── Failure diagnosis ─────────────────────────────────────────────────────────
# Every provider reports failures as a deeply-nested exception whose useful part is the
# last line of a ~30-frame traceback (langchain -> boto/httpx -> transport). Under
# core/logging.py's JsonFormatter that traceback becomes a single escaped JSON string
# field, which is where a real cause like "your SSO token expired" goes to die. These
# matchers pull the cause back to the front of the message. Classification is by
# exception class name and message text rather than by importing botocore/httpx, so this
# keeps working when only one provider's extras are installed.
def describe_llm_error(exc: BaseException) -> str:
    """One actionable line naming the real cause, for logs and diagnostics."""
    name = type(exc).__name__
    text = str(exc)
    lowered = text.lower()

    # AWS Bedrock — botocore generates one exception class per modeled error code, so the
    # class name *is* the error code (AccessDeniedException, ValidationException, ...).
    if name in {"ExpiredTokenException", "InvalidSignatureException"} or "expired" in lowered:
        return (
            f"{name}: AWS credentials are expired or invalid — refresh them "
            "(aws sso login, or update AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in .env)"
        )
    if name in {"NoCredentialsError", "PartialCredentialsError", "UnrecognizedClientException"}:
        return (
            f"{name}: no usable AWS credentials found — set AWS_ACCESS_KEY_ID and "
            "AWS_SECRET_ACCESS_KEY in .env, or configure a profile with aws configure"
        )
    if name == "AccessDeniedException":
        return (
            f"{name}: the AWS identity is authenticated but not allowed to invoke this "
            "model — enable model access for it in the Bedrock console (Model access) and "
            f"allow bedrock:InvokeModel in the IAM policy. AWS said: {text}"
        )
    if name == "ValidationException":
        return (
            f"{name}: Bedrock rejected the request — usually BEDROCK_MODEL_ID is not valid "
            "for AWS_REGION, or the model needs its cross-region inference-profile id (the "
            f"us. prefix) rather than the bare foundation-model id. AWS said: {text}"
        )
    if name == "ResourceNotFoundException":
        return (
            f"{name}: no such model in this region — check BEDROCK_MODEL_ID against "
            f"AWS_REGION. AWS said: {text}"
        )
    if name in {"ThrottlingException", "TooManyRequestsException", "ServiceQuotaExceededException"}:
        return f"{name}: Bedrock is throttling this account — retry with backoff. AWS said: {text}"
    if name in {"EndpointConnectionError", "ConnectTimeoutError"}:
        return f"{name}: could not reach the Bedrock endpoint — check network and AWS_REGION"

    # Ollama — a local daemon, so the two failures are "not running" and "not pulled".
    if name in {"ConnectError", "ConnectionError"} or "connection refused" in lowered:
        return (
            f"{name}: cannot reach the Ollama server at OLLAMA_BASE_URL — start it with "
            f"ollama serve, or correct OLLAMA_BASE_URL. Original: {text}"
        )
    if "not found" in lowered and ("model" in lowered or "pull" in lowered):
        return (
            f"{name}: Ollama does not have that model locally — run ollama pull for the "
            f"name in OLLAMA_MODEL / OLLAMA_EMBEDDING_MODEL. Original: {text}"
        )
    if "timeout" in lowered or name in {"ReadTimeout", "ConnectTimeout"}:
        return (
            f"{name}: the model backend timed out — a cold Ollama model load can exceed the "
            f"client timeout; retry once the model is resident. Original: {text}"
        )

    # OpenAI
    if name in {"AuthenticationError", "PermissionDeniedError"}:
        return f"{name}: OPENAI_API_KEY is missing, wrong, or lacks access. Original: {text}"
    if name == "RateLimitError":
        return f"{name}: OpenAI rate limit or quota exhausted. Original: {text}"

    return f"{name}: {text}"


def log_llm_failure(where: str, exc: BaseException, **context: object) -> None:
    """Logs a provider failure as one scannable line, plus the full traceback.

    Call sites deliberately swallow LLM errors — a missing book embedding or an
    unavailable review digest degrades gracefully rather than 500ing the request — which
    is the right behaviour but leaves the log as the *only* evidence the feature is
    broken. This makes that evidence say why on the first line instead of the last.
    """
    s = get_settings()
    detail_str = " ".join(f"{k}={v}" for k, v in context.items())
    logger.error(
        "%s failed [mode=%s %s]: %s",
        where,
        s.llm_mode.lower(),
        detail_str,
        describe_llm_error(exc),
        exc_info=exc,
    )


# ── Per-call tracing (LLM_DEBUG=true) ─────────────────────────────────────────
class _LlmDebugCallback(BaseCallbackHandler):
    """Logs each model turn and tool call the agent makes, with latency.

    Attached at construction so it also covers the ReAct agent's *internal* turns — a
    call site's own try/except only ever sees the final exception, which hides both "the
    model answered without calling any tool" and "the model looped three times", the two
    shapes a chatbot complaint usually turns out to have.
    """

    def __init__(self, mode: str, model: str) -> None:
        self._mode = mode
        self._model = model
        # Keyed by LangChain's per-invocation run_id; entries are popped on end/error, so
        # this only ever holds the runs currently in flight.
        self._started: dict[Any, float] = {}

    def _begin(self, kwargs: dict[str, Any]) -> None:
        self._started[kwargs.get("run_id")] = time.monotonic()

    def _elapsed_ms(self, kwargs: dict[str, Any]) -> float:
        start = self._started.pop(kwargs.get("run_id"), None)
        return (time.monotonic() - start) * 1000 if start else -1.0

    def on_chat_model_start(self, serialized: Any, messages: Any, **kwargs: Any) -> None:
        self._begin(kwargs)
        turn = messages[0] if messages else []
        logger.debug(
            "llm.request: mode=%s model=%s messages=%d last=%s",
            self._mode,
            self._model,
            len(turn),
            _preview(turn[-1].content if turn else ""),
        )

    def on_llm_start(self, serialized: Any, prompts: Any, **kwargs: Any) -> None:
        self._begin(kwargs)
        logger.debug(
            "llm.request: mode=%s model=%s prompts=%d first=%s",
            self._mode,
            self._model,
            len(prompts),
            _preview(prompts[0] if prompts else ""),
        )

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        text: str = ""
        tool_calls: list[Any] = []
        usage: Any = None
        try:
            generation = response.generations[0][0]
            text = generation.text
            message = getattr(generation, "message", None)
            tool_calls = [c.get("name") for c in getattr(message, "tool_calls", None) or []]
            usage = getattr(message, "usage_metadata", None)
        except (AttributeError, IndexError, TypeError):
            pass
        logger.info(
            "llm.response: mode=%s model=%s elapsed_ms=%.0f tool_calls=%s tokens=%s reply=%s",
            self._mode,
            self._model,
            self._elapsed_ms(kwargs),
            tool_calls or "none",
            usage or "n/a",
            _preview(text),
        )

    def on_llm_error(self, error: BaseException, **kwargs: Any) -> None:
        logger.error(
            "llm.error: mode=%s model=%s elapsed_ms=%.0f — %s",
            self._mode,
            self._model,
            self._elapsed_ms(kwargs),
            describe_llm_error(error),
        )

    def on_tool_start(self, serialized: Any, input_str: str, **kwargs: Any) -> None:
        self._begin(kwargs)
        logger.debug(
            "tool.request: name=%s args=%s",
            (serialized or {}).get("name", "?"),
            _preview(input_str),
        )

    def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        logger.debug(
            "tool.response: elapsed_ms=%.0f result=%s",
            self._elapsed_ms(kwargs),
            _preview(output),
        )

    def on_tool_error(self, error: BaseException, **kwargs: Any) -> None:
        logger.error(
            "tool.error: elapsed_ms=%.0f — %s: %s",
            self._elapsed_ms(kwargs),
            type(error).__name__,
            error,
        )


def _debug_callbacks(mode: str, model: str) -> list[BaseCallbackHandler]:
    """Attached only when LLM_DEBUG=true — the handler logs prompts and replies verbatim,
    which is what you want while diagnosing and not what you want in a production log.
    Failures are reported either way, by log_llm_failure at the call sites."""
    return [_LlmDebugCallback(mode, model)] if get_settings().llm_debug else []


def build_chat_llm() -> BaseChatModel:
    s = get_settings()
    mode = s.llm_mode.lower()

    if mode == "bedrock":
        from langchain_aws import ChatBedrockConverse

        has_creds = bool(s.aws_access_key_id and s.aws_secret_access_key)
        _log_resolved(
            "build_chat_llm", mode, model_id=s.bedrock_model_id, region=s.aws_region,
            explicit_credentials=has_creds,
        )
        kwargs: dict[str, Any] = {
            "model_id": s.bedrock_model_id,
            "region_name": s.aws_region,
            "callbacks": _debug_callbacks(mode, s.bedrock_model_id),
        }
        if has_creds:
            kwargs["aws_access_key_id"] = s.aws_access_key_id
            kwargs["aws_secret_access_key"] = s.aws_secret_access_key
        try:
            return ChatBedrockConverse(**kwargs)
        except Exception as exc:
            log_llm_failure(
                "build_chat_llm(ChatBedrockConverse)", exc,
                model_id=s.bedrock_model_id, region=s.aws_region,
            )
            raise

    if mode == "ollama":
        from langchain_ollama import ChatOllama

        _log_resolved("build_chat_llm", mode, model=s.ollama_model, base_url=s.ollama_base_url)
        try:
            return ChatOllama(
                model=s.ollama_model,
                base_url=s.ollama_base_url,
                callbacks=_debug_callbacks(mode, s.ollama_model),
            )
        except Exception as exc:
            log_llm_failure(
                "build_chat_llm(ChatOllama)", exc,
                model=s.ollama_model, base_url=s.ollama_base_url,
            )
            raise

    from langchain_openai import ChatOpenAI

    _log_resolved("build_chat_llm", mode, model=s.openai_model, has_api_key=bool(s.openai_api_key))
    try:
        return ChatOpenAI(
            model=s.openai_model,
            api_key=SecretStr(s.openai_api_key),
            temperature=0.3,
            callbacks=_debug_callbacks(mode, s.openai_model),
        )
    except Exception as exc:
        log_llm_failure("build_chat_llm(ChatOpenAI)", exc, model=s.openai_model)
        raise


def build_embeddings() -> Embeddings:
    """Same LLM_MODE branch as build_chat_llm(), for the one feature (book similarity)
    that needs vectors instead of text. Kept as a separate factory rather than a second
    branch inside build_chat_llm() — a chat model and an embedding model are different
    LangChain interfaces, and callers need to pick the right one, not get one implicitly.

    The embedding model is configured *separately* from the chat model on every provider,
    and chat working says nothing about embeddings working: on Bedrock they are distinct
    model ids each needing their own model-access grant, and on Ollama a separate
    `ollama pull`. Related-books quietly returning nothing while chat is fine is almost
    always that gap — check the log for build_embeddings / ensure_embedding.
    """
    s = get_settings()
    mode = s.llm_mode.lower()

    if mode == "bedrock":
        from langchain_aws import BedrockEmbeddings

        has_creds = bool(s.aws_access_key_id and s.aws_secret_access_key)
        _log_resolved(
            "build_embeddings", mode, model_id=s.bedrock_embedding_model_id,
            region=s.aws_region, explicit_credentials=has_creds,
        )
        kwargs: dict[str, Any] = {
            "model_id": s.bedrock_embedding_model_id,
            "region_name": s.aws_region,
        }
        if has_creds:
            kwargs["aws_access_key_id"] = s.aws_access_key_id
            kwargs["aws_secret_access_key"] = s.aws_secret_access_key
        try:
            return BedrockEmbeddings(**kwargs)
        except Exception as exc:
            log_llm_failure(
                "build_embeddings(BedrockEmbeddings)", exc,
                model_id=s.bedrock_embedding_model_id, region=s.aws_region,
            )
            raise

    if mode == "ollama":
        from langchain_ollama import OllamaEmbeddings

        _log_resolved(
            "build_embeddings", mode, model=s.ollama_embedding_model, base_url=s.ollama_base_url,
        )
        try:
            return OllamaEmbeddings(model=s.ollama_embedding_model, base_url=s.ollama_base_url)
        except Exception as exc:
            log_llm_failure(
                "build_embeddings(OllamaEmbeddings)", exc,
                model=s.ollama_embedding_model, base_url=s.ollama_base_url,
            )
            raise

    from langchain_openai import OpenAIEmbeddings

    _log_resolved(
        "build_embeddings", mode, model=s.openai_embedding_model,
        has_api_key=bool(s.openai_api_key),
    )
    try:
        return OpenAIEmbeddings(model=s.openai_embedding_model, api_key=SecretStr(s.openai_api_key))
    except Exception as exc:
        log_llm_failure("build_embeddings(OpenAIEmbeddings)", exc, model=s.openai_embedding_model)
        raise


def extract_json_object(text: str) -> dict[str, Any] | None:
    """Small local models sometimes wrap a requested JSON reply in a markdown code
    fence despite being told not to — strip one if present before parsing. Shared by
    every feature that asks the model for structured output instead of prose
    (recommendations' describe-to-quiz, books' cover identification).
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    try:
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        # Callers only see None, which looks identical to "the backend is down" — log the
        # reply that failed to parse so a prompt-adherence problem is distinguishable from
        # a transport one.
        logger.warning("extract_json_object: reply was not valid JSON: %s", _preview(text))
        return None
    if not isinstance(parsed, dict):
        logger.warning("extract_json_object: expected a JSON object, got %s", type(parsed).__name__)
        return None
    return parsed
