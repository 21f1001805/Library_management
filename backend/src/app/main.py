import asyncio
import contextlib
import logging
import os
import subprocess
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes.health import router as health_router
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.core.rate_limit import limiter
from app.db.prisma import prisma
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.billing_requests.router import router as billing_requests_router
from app.modules.book_records.router import router as book_records_router
from app.modules.books.router import router as books_router
from app.modules.chat.router import router as chat_router
from app.modules.community.router import router as community_router
from app.modules.contact.router import router as contact_router
from app.modules.coupons.router import router as coupons_router
from app.modules.events.router import router as events_router
from app.modules.guardian.router import router as guardian_router
from app.modules.it_head.router import router as it_head_router
from app.modules.leaderboard.router import router as leaderboard_router
from app.modules.loans.router import router as loans_router
from app.modules.loans.service import send_due_soon_reminders
from app.modules.manager.router import router as manager_router
from app.modules.members.router import router as members_router
from app.modules.notifications.router import router as notifications_router
from app.modules.payments.router import router as payments_router
from app.modules.permission_requests.router import router as permission_requests_router
from app.modules.pricing_plans.router import router as pricing_plans_router
from app.modules.recommendations.router import router as recommendations_router
from app.modules.reservations.router import router as reservations_router
from app.modules.reviews.router import router as reviews_router
from app.modules.seat_booking.router import router as seat_booking_router
from app.modules.support_tickets.router import router as support_tickets_router
from app.modules.translate.router import router as translate_router

# Windows' console defaults to a legacy codepage (cp1252 here) that can't encode the
# box-drawing characters in the startup banner below, crashing print() with
# UnicodeEncodeError before the app ever serves a request. Force UTF-8 on stdout/stderr
# so that and any other non-ASCII output (e.g. the ₹ sign in log messages) is safe
# regardless of the host console's codepage. A no-op on platforms already UTF-8.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

configure_logging()
logger = logging.getLogger(__name__)

REMINDER_LOOP_INTERVAL_SECONDS = 24 * 60 * 60


# This is an in-process asyncio task — running N app instances means N independent
# sweep loops, each on its own timer. That's safe from duplicate sends only because
# send_due_soon_reminders() checks Loan.lastRemindedAt (a DB-backed cooldown) before
# nudging, not because of anything here. Don't remove that check without accounting
# for multi-instance duplicate reminders.
async def _due_soon_reminder_loop() -> None:
    while True:
        # One bad run shouldn't kill the loop, but it must not vanish silently either.
        try:
            await send_due_soon_reminders()
        except Exception:
            logger.exception("send_due_soon_reminders failed")
        await asyncio.sleep(REMINDER_LOOP_INTERVAL_SECONDS)


SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "prisma" / "schema.prisma"


def _run_migrate_deploy(database_url: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "prisma", "migrate", "deploy", "--schema", str(SCHEMA_PATH)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env={**os.environ, "DATABASE_URL": database_url},
    )


async def _apply_pending_migrations(database_url: str) -> None:
    """Bring the schema up to date before anything serves traffic.

    Pulling a branch that added a migration used to leave the database behind until
    someone remembered to run `prisma migrate deploy` by hand — the symptom was a pile
    of unrelated-looking test and request failures. `migrate deploy` is idempotent and
    holds an advisory lock for the duration, so this is safe to run on every boot and
    with several instances starting at once.

    Runs via `subprocess.run` in a worker thread rather than
    `asyncio.create_subprocess_exec` — the latter needs a ProactorEventLoop on Windows,
    but uvicorn's `--reload` supervisor forces its worker subprocess onto a
    SelectorEventLoop there (see uvicorn/loops/asyncio.py: `use_subprocess=True` picks
    SelectorEventLoop even on win32), which raises `NotImplementedError` on any asyncio
    subprocess call. `subprocess.run` doesn't go through the event loop's subprocess
    transport at all, so it works under either loop type.
    """
    result = await asyncio.to_thread(_run_migrate_deploy, database_url)
    output = result.stdout.strip()

    if result.returncode != 0:
        # Serving against a schema the code does not match produces failures that look
        # like anything but a migration problem, so refuse to start instead.
        logger.error("prisma migrate deploy failed: %s", output)
        raise RuntimeError("Database migrations failed; refusing to start")

    if "No pending migrations" in output:
        logger.info("database schema already up to date")
    else:
        logger.info("applied pending database migrations")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    reminder_task: asyncio.Task | None = None
    if settings.app_env != "test":
        os.environ.setdefault("DATABASE_URL", settings.database_url)
        if settings.auto_migrate:
            await _apply_pending_migrations(settings.database_url)
        await prisma.connect()
        reminder_task = asyncio.create_task(_due_soon_reminder_loop())

    # ── Startup config summary ────────────────────────────────────────────
    llm_detail = {
        "bedrock": f"bedrock ({settings.bedrock_model_id}, region={settings.aws_region})",
        "ollama": f"ollama ({settings.ollama_model} @ {settings.ollama_base_url})",
        "openai": f"openai ({settings.openai_model})",
    }.get(settings.llm_mode.lower(), settings.llm_mode)
    print(f"""
╔══════════════════════════════════════════════════════╗
║              MAY2026 Team 041 — API                  ║
╠══════════════════════════════════════════════════════╣
║  DB   : {settings.database_url.split("@")[-1]:<44}║
║  LLM  : {llm_detail:<44}║
║  Redis: {settings.redis_url:<44}║
║  Env  : {settings.app_env:<44}║
╚══════════════════════════════════════════════════════╝
""")
    yield
    if reminder_task is not None:
        reminder_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await reminder_task
    if settings.app_env != "test":
        await prisma.disconnect()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # No CSP here: this app serves JSON, not documents, so a policy belongs on whatever
    # serves the built frontend. These four are the ones that still matter for an API —
    # they stop MIME sniffing, framing, and referrer leakage to third parties, and pin
    # clients to HTTPS once they have seen the header.
    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        # Only meaningful over HTTPS, and harmful if sent while still on plain HTTP in
        # local development — browsers would refuse http://localhost afterwards.
        if settings.app_env == "production":
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response

    app.state.limiter = limiter
    # slowapi's own documented handler is typed for RateLimitExceeded specifically,
    # narrower than add_exception_handler's general Exception signature — safe at
    # runtime (Starlette dispatches by the registered exception type), just not
    # expressible in add_exception_handler's overloads.
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    app.include_router(health_router)
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(members_router, prefix=settings.api_prefix)
    app.include_router(books_router, prefix=settings.api_prefix)
    app.include_router(book_records_router, prefix=settings.api_prefix)
    app.include_router(payments_router, prefix=settings.api_prefix)
    app.include_router(guardian_router, prefix=settings.api_prefix)
    app.include_router(manager_router, prefix=settings.api_prefix)
    app.include_router(reservations_router, prefix=settings.api_prefix)
    app.include_router(recommendations_router, prefix=settings.api_prefix)
    app.include_router(translate_router, prefix=settings.api_prefix)
    app.include_router(community_router, prefix=settings.api_prefix)
    app.include_router(contact_router, prefix=settings.api_prefix)
    app.include_router(seat_booking_router, prefix=settings.api_prefix)
    app.include_router(notifications_router, prefix=settings.api_prefix)
    app.include_router(reviews_router, prefix=settings.api_prefix)
    app.include_router(admin_router, prefix=settings.api_prefix)
    app.include_router(billing_requests_router, prefix=settings.api_prefix)
    app.include_router(pricing_plans_router, prefix=settings.api_prefix)
    app.include_router(coupons_router, prefix=settings.api_prefix)
    app.include_router(support_tickets_router, prefix=settings.api_prefix)
    app.include_router(events_router, prefix=settings.api_prefix)
    app.include_router(chat_router, prefix=settings.api_prefix)
    app.include_router(permission_requests_router, prefix=settings.api_prefix)
    app.include_router(loans_router, prefix=settings.api_prefix)
    app.include_router(it_head_router, prefix=settings.api_prefix)
    app.include_router(leaderboard_router, prefix=settings.api_prefix)
    return app


app = create_app()
