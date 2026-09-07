"""Redis pub/sub so a book's availability changing (issued or returned) pushes to
anyone watching the manager's book-availability list immediately, instead of only on
their next filter change or page reload. Mirrors the pattern in visits/events.py.

One global channel, not one per book: the manager list is a paginated/filtered view,
not a single row, so there's nothing meaningful to push directly — subscribers just
treat any signal as "your current page may be stale, refetch it."
"""

import logging
from collections.abc import AsyncIterator

import redis.asyncio as aioredis
from fastapi import Request

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None

_CHANNEL = "books:availability"


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


async def publish_availability_changed() -> None:
    try:
        await _get_redis().publish(_CHANNEL, "changed")
    except Exception:
        logger.exception("Failed to publish book availability change")


_KEEPALIVE_SECONDS = 15.0


async def subscribe_availability_changes(request: Request) -> AsyncIterator[bool]:
    """Yields True on a real change signal, False on a keep-alive tick."""
    pubsub = _get_redis().pubsub()
    await pubsub.subscribe(_CHANNEL)
    try:
        while True:
            if await request.is_disconnected():
                break
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=_KEEPALIVE_SECONDS
            )
            yield message is not None
    finally:
        await pubsub.unsubscribe(_CHANNEL)
        await pubsub.aclose()
