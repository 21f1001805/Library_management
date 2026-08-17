"""
Chat orchestrator using LangGraph ReAct agent (LangChain 1.x / LangGraph).

Flow:
  1. RAG  — fast keyword match against FAQ knowledge base (no LLM cost).
  2. TAG  — LangChain tools wrapping existing service functions for live DB data.
  3. LLM  — gpt-4o-mini with a role-aware system prompt orchestrates tool calls.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from app.core.config import get_settings
from app.modules.books import service as books_service
from app.modules.chat.knowledge import find_rag_answer
from app.modules.chat.schemas import ChatMessage, ChatResponse
from app.modules.events import service as events_service
from app.modules.members import service as members_service

# ── Per-request context (set before each agent invocation) ───────────────────
_ctx: dict[str, Any] = {}


# ── TAG Tools ─────────────────────────────────────────────────────────────────

@tool
def get_upcoming_events(query: str = "") -> str:
    """Fetch upcoming library events. Use when the user asks about events,
    schedules, workshops, or what is happening at the library."""
    member_id = _ctx.get("member_id")
    result = asyncio.get_event_loop().run_until_complete(
        events_service.list_events(page=1, page_size=10, member_id=member_id)
    )
    if not result.items:
        return "No upcoming events found."
    return json.dumps([
        {
            "title": e.title,
            "date": e.date.strftime("%d %b %Y, %I:%M %p"),
            "location": e.location,
            "capacity": e.capacity,
            "attendees": e.attendees,
            "registered": e.registered,
        }
        for e in result.items
    ])


@tool
def get_books(query: str = "") -> str:
    """Search the library book catalog. Use when the user asks about available books,
    searches for a title or author, or wants to know what books are in the library.
    Pass the search term as query."""
    result = asyncio.get_event_loop().run_until_complete(
        books_service.list_books(search=query or None, category=None, page=1, page_size=10)
    )
    if not result.items:
        return "No books found matching that query."
    return json.dumps([
        {
            "title": b.title,
            "author": b.author,
            "category": b.category,
            "available": b.available,
            "copies": b.total_copies,
        }
        for b in result.items
    ])


@tool
def get_members(query: str = "") -> str:
    """Search library members. Only for admin, librarian, and manager roles.
    Use when staff asks about member counts or searches for a member by name or email."""
    if _ctx.get("role", "member") not in ("admin", "librarian", "manager"):
        return "You don't have permission to view member data."
    result = asyncio.get_event_loop().run_until_complete(
        members_service.list_members(search=query or None, page=1, page_size=10)
    )
    if not result.items:
        return "No members found."
    return json.dumps([
        {
            "name": m.full_name,
            "email": m.email,
            "role": m.role.name,
            "active": m.is_active,
            "last_login": m.last_login_at.strftime("%d %b %Y") if m.last_login_at else "Never",
        }
        for m in result.items
    ])


@tool
def get_my_reading_progress(query: str = "") -> str:
    """Get the current user's reading progress — books they are reading or have completed."""
    member_id = _ctx.get("member_id")
    if not member_id:
        return "Could not identify the current user."
    items = asyncio.get_event_loop().run_until_complete(
        members_service.list_reading_progress(member_id)
    )
    if not items:
        return "No reading progress recorded yet."
    return json.dumps([
        {"book": p.book_title, "status": p.status, "percent": p.percent_complete}
        for p in items
    ])


# ── Tools list ────────────────────────────────────────────────────────────────
TOOLS = [get_upcoming_events, get_books, get_members, get_my_reading_progress]


# ── System prompt ─────────────────────────────────────────────────────────────
def _system_prompt(user_name: str, role: str, member_id: str) -> str:
    return f"""You are Shelfie, a friendly library assistant for the Community Reading Club platform.

Current user: {user_name} | Role: {role} | ID: {member_id}

Role capabilities:
- member/guardian: own books, events, seat bookings, fines, reading progress.
- librarian/manager: also member lists and library operations.
- admin/it-head: full access to all data.

Guidelines:
- Be concise and warm.
- Use tools for live data (events, books, members, reading progress).
- Answer how-to questions from your own knowledge without tools.
- Format lists with bullet points or numbered steps.
- Never make up data — only report what tools return.
- If the user's role doesn't permit an action, politely explain why."""


# ── Orchestrator ──────────────────────────────────────────────────────────────
async def run_chat(
    *,
    message: str,
    history: list[ChatMessage],
    member_id: str,
    user_name: str,
    role: str,
) -> ChatResponse:
    settings = get_settings()

    if not settings.openai_api_key:
        return ChatResponse(
            reply="The AI assistant is not configured. Please add OPENAI_API_KEY to backend/.env.",
            source="error",
        )

    # 1. RAG — instant keyword match, no LLM cost
    rag_answer = find_rag_answer(message)
    if rag_answer:
        return ChatResponse(reply=rag_answer, source="rag")

    # 2. TAG + LLM via LangGraph ReAct agent
    _ctx["member_id"] = member_id
    _ctx["role"] = role

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.3,
    )

    agent = create_react_agent(llm, TOOLS)

    # Build message list: system + history + current message
    msgs: list = [SystemMessage(content=_system_prompt(user_name, role, member_id))]
    for h in history[-6:]:
        if h.role == "user":
            msgs.append(HumanMessage(content=h.content))
        else:
            from langchain_core.messages import AIMessage
            msgs.append(AIMessage(content=h.content))
    msgs.append(HumanMessage(content=message))

    try:
        result = await agent.ainvoke({"messages": msgs})
        # LangGraph returns messages list; last message is the final answer
        final = result["messages"][-1].content
        is_tag = any(
            kw in message.lower()
            for kw in ["event", "book", "member", "progress", "reading", "show", "list", "how many"]
        )
        return ChatResponse(reply=final, source="tag" if is_tag else "llm")
    except Exception as exc:  # noqa: BLE001
        return ChatResponse(reply=f"Something went wrong: {exc}", source="error")
