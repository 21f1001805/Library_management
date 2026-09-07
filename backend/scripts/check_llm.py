"""One-shot health check for whichever LLM backend LLM_MODE selects.

    python scripts/check_llm.py              # check the configured mode
    python scripts/check_llm.py bedrock      # check a specific mode, ignoring .env
    python scripts/check_llm.py ollama openai

Exercises the same factories the app uses (core.llm.build_chat_llm / build_embeddings)
and reports each step as OK or as the one-line diagnosis from core.llm.describe_llm_error.

Worth its own script rather than a health-check endpoint because the failures it catches
are mostly *configuration* failures — an expired SSO token, a model not enabled in the
configured region, a model that was never pulled — and you want the answer before
starting the server, not after a user reports the chatbot is quiet. It also checks chat
and embeddings separately: those are different models needing separate access on every
provider, and having chat work tells you nothing about related-books working.

Run it from backend/ so the .env files resolve the same way uvicorn resolves them (see
core/config.py's _log_env_provenance).
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

# Same reason as main.py: Windows' console defaults to a legacy codepage that cannot
# encode the em-dashes in the diagnosis messages below.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

from langchain_core.messages import HumanMessage  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.llm import build_chat_llm, build_embeddings, describe_llm_error  # noqa: E402

OK = "  OK   "
FAIL = " FAIL  "


def _print(status: str, step: str, detail: str) -> None:
    print(f"[{status}] {step}: {detail}")


async def _check_chat() -> bool:
    s = get_settings()
    model = {"bedrock": s.bedrock_model_id, "ollama": s.ollama_model}.get(
        s.llm_mode.lower(), s.openai_model
    )
    try:
        llm = build_chat_llm()
    except Exception as exc:
        _print(FAIL, f"chat construct ({model})", describe_llm_error(exc))
        return False
    try:
        reply = await llm.ainvoke([HumanMessage(content="Reply with the single word: ready")])
    except Exception as exc:
        _print(FAIL, f"chat invoke ({model})", describe_llm_error(exc))
        return False
    _print(OK, f"chat invoke ({model})", repr(str(reply.content).strip()[:80]))
    return True


async def _check_embeddings() -> bool:
    s = get_settings()
    model = {"bedrock": s.bedrock_embedding_model_id, "ollama": s.ollama_embedding_model}.get(
        s.llm_mode.lower(), s.openai_embedding_model
    )
    try:
        embeddings = build_embeddings()
    except Exception as exc:
        _print(FAIL, f"embeddings construct ({model})", describe_llm_error(exc))
        return False
    try:
        vector = await embeddings.aembed_query("a book about the sea")
    except Exception as exc:
        _print(FAIL, f"embeddings invoke ({model})", describe_llm_error(exc))
        return False
    _print(OK, f"embeddings invoke ({model})", f"{len(vector)} dimensions")
    return True


async def _check_tool_calling() -> bool:
    """The chatbot answers data questions by calling tools, so a model that chats fine but
    cannot emit a tool call still looks broken to a user. Ollama reports this up front —
    a model without "tools" in its capabilities will never call one no matter the prompt.
    """
    try:
        llm = build_chat_llm()
        bound = llm.bind_tools(
            [
                {
                    "name": "get_books",
                    "description": "Look up books in the library catalog.",
                    "parameters": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                        "required": ["query"],
                    },
                }
            ]
        )
        reply = await bound.ainvoke(
            [HumanMessage(content="Find me books about sailing. Use the get_books tool.")]
        )
    except Exception as exc:
        _print(FAIL, "tool calling", describe_llm_error(exc))
        return False

    calls = [c.get("name") for c in getattr(reply, "tool_calls", None) or []]
    if not calls:
        _print(
            FAIL,
            "tool calling",
            "model replied without calling a tool — the chatbot will answer data "
            "questions from memory instead of the catalog. Use a tool-capable model.",
        )
        return False
    _print(OK, "tool calling", f"called {calls}")
    return True


async def check_mode(mode: str | None) -> bool:
    if mode is not None:
        os.environ["LLM_MODE"] = mode
        get_settings.cache_clear()

    s = get_settings()
    print(f"\n=== LLM_MODE={s.llm_mode} ===")
    if s.llm_mode.lower() == "bedrock":
        explicit = bool(s.aws_access_key_id and s.aws_secret_access_key)
        print(f"    region={s.aws_region} explicit_credentials={explicit}")
    elif s.llm_mode.lower() == "ollama":
        print(f"    base_url={s.ollama_base_url}")

    results = [await _check_chat(), await _check_tool_calling(), await _check_embeddings()]
    return all(results)


async def main() -> int:
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    # langchain_aws logs the raw boto traceback itself before re-raising; this script
    # reports that same failure as a one-line diagnosis, so the traceback is pure noise
    # here. The app still gets it — log_llm_failure passes exc_info.
    logging.getLogger("langchain_aws").setLevel(logging.CRITICAL)
    modes: list[str | None] = list(sys.argv[1:]) or [None]
    ok = all([await check_mode(mode) for mode in modes])
    print("\nAll checks passed." if ok else "\nSome checks failed — see FAIL lines above.")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
