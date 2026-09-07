"""Redis pub/sub so a check-in/check-out pushes straight to the member's open dashboard
tab instead of waiting for its next poll. Mirrors the lazy-singleton client pattern
chat/history.py already uses for Redis, kept local to this module rather than shared —
same convention every other module here follows for its own storage access.
"""

import logging
from collections.abc import AsyncIterator

import redis.asyncio as aioredis
from fastapi import Request

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


def _channel(member_id: str) -> str:
    return f"visits:status:{member_id}"


async def publish_status_change(member_id: str, payload_json: str) -> None:
    # Best-effort: a Redis hiccup should never fail the check-in/out request itself —
    # the member's dashboard just falls back to its normal poll instead of getting
    # the instant push.
    try:
        await _get_redis().publish(_channel(member_id), payload_json)
    except Exception:
        logger.exception("Failed to publish visit status change for member %s", member_id)


# Without a periodic yield, an idle stream eventually gets killed by the browser or an
# intermediary proxy that assumes a silent connection is dead — this both keeps it open
# and bounds how long a dropped client goes undetected server-side.
_KEEPALIVE_SECONDS = 15.0


async def subscribe_status(member_id: str, request: Request) -> AsyncIterator[str]:
    """Yields fully-formatted SSE frames: real updates as they're published, or a
    keep-alive comment every _KEEPALIVE_SECONDS of silence. Stops once the client
    disconnects, unsubscribing so the Redis connection doesn't leak."""
    pubsub = _get_redis().pubsub()
    channel = _channel(member_id)
    await pubsub.subscribe(channel)
    try:
        while True:
            if await request.is_disconnected():
                break
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=_KEEPALIVE_SECONDS
            )
            if message is None:
                yield ": keep-alive\n\n"
                continue
            yield f"data: {message['data']}\n\n"
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
