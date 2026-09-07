"""Redis pub/sub so a reservation decision reaches the member's open tab immediately.

The decision that matters here is made by someone else entirely: a manager approves or
rejects from their own screen, and until now the member's reservations list only learned
about it on a reload. Same lazy-singleton client pattern as visits/events.py.

Per-member channels, not one global one: a reservation belongs to exactly one member, and
a member has no business being woken up by strangers' queue activity.

Unlike visits/events.py this publishes a bare signal rather than the new state. A
reservation row on its own is not what the page renders — list_my_reservations recomputes
every entry's queue position and ETA against *other* members' pending requests and active
loans, so a payload built at publish time would be stale for anyone but the one member
whose row changed. Subscribers treat any signal as "refetch", which keeps that maths in
the one place that already does it correctly.
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
    return f"reservations:member:{member_id}"


async def publish_reservations_changed(member_id: str) -> None:
    # Best-effort, exactly as in visits/events.py: a Redis hiccup must never fail the
    # approve/reject/cancel request that triggered it. The member's list falls back to
    # its normal poll instead of getting the instant push.
    try:
        await _get_redis().publish(_channel(member_id), "changed")
    except Exception:
        logger.exception("Failed to publish reservation change for member %s", member_id)


_KEEPALIVE_SECONDS = 15.0


async def subscribe_reservation_changes(member_id: str, request: Request) -> AsyncIterator[str]:
    """Yields fully-formatted SSE frames: "changed" as decisions land, or a keep-alive
    comment every _KEEPALIVE_SECONDS of silence. Stops once the client disconnects,
    unsubscribing so the Redis connection doesn't leak."""
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
