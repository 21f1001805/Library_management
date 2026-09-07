"""Redis pub/sub for the seat-availability grid: booking or cancelling a seat publishes
a signal so anyone else watching that same date/hour slot sees it change immediately,
instead of only on their next reopen. Mirrors the pattern in visits/events.py.
"""

import logging
from collections.abc import AsyncIterator
from datetime import date as date_type

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


def _channel(target_date: date_type, hour: int) -> str:
    return f"seats:schedule:{target_date.isoformat()}:{hour}"


async def publish_schedule_change(target_date: date_type, hour: int) -> None:
    try:
        await _get_redis().publish(_channel(target_date, hour), "changed")
    except Exception:
        logger.exception("Failed to publish seat schedule change for %s %s", target_date, hour)


_KEEPALIVE_SECONDS = 15.0


async def subscribe_schedule_signal(
    target_date: date_type, hour: int, request: Request
) -> AsyncIterator[bool]:
    """Yields True on a real change signal, False on a keep-alive tick. The caller (an
    SSE endpoint) recomputes the schedule on True rather than this module pushing a
    payload directly — unlike visits, the seat grid's view is per-viewer (booked_by_me
    vs. reserved depends on who's asking), so nothing here can be precomputed once for
    every subscriber on the same date/hour.
    """
    pubsub = _get_redis().pubsub()
    channel = _channel(target_date, hour)
    await pubsub.subscribe(channel)
    try:
        while True:
            if await request.is_disconnected():
                break
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=_KEEPALIVE_SECONDS
            )
            yield message is not None
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
