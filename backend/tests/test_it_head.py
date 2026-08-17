import os
import uuid
from datetime import UTC, datetime, timedelta

os.environ["APP_ENV"] = "test"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.constants import Role
from app.db.prisma import prisma
from app.main import create_app
from app.modules.members import repository as member_repository

os.environ.setdefault("DATABASE_URL", get_settings().database_url)

TEST_EMAIL_DOMAIN = "@it-head-dashboard-test.example.com"
TEST_BOOK_TITLE_PREFIX = "IT Head Test Book"


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


async def _make_user(role_name: str):
    role = await member_repository.upsert_role(role_name)
    return await member_repository.create_member(
        email=_unique_email(),
        password_hash=None,
        full_name=f"Test {role_name.title()}",
        phone=None,
        avatar_url=None,
        role_id=role.id,
    )


@pytest_asyncio.fixture(scope="module", autouse=True)
async def _db_connection():
    await prisma.connect()
    yield
    domain_filter = {"email": {"endswith": TEST_EMAIL_DOMAIN}}
    await prisma.loan.delete_many(where={"member": domain_filter})
    await prisma.supportticket.delete_many(where={"raisedBy": domain_filter})
    await prisma.permissionrequest.delete_many(where={"requestedBy": domain_filter})
    await prisma.payment.delete_many(where={"user": domain_filter})
    await prisma.user.delete_many(where=domain_filter)
    await prisma.book.delete_many(where={"title": {"startswith": TEST_BOOK_TITLE_PREFIX}})
    await prisma.disconnect()


@pytest_asyncio.fixture
async def it_head_user():
    return await _make_user(Role.IT_HEAD)


@pytest_asyncio.fixture
async def member_user():
    return await _make_user(Role.MEMBER)


def _client_as(user) -> AsyncClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _anon_client() -> AsyncClient:
    app = create_app()
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_dashboard_requires_authentication():
    async with _anon_client() as client:
        response = await client.get("/api/v1/it-head/dashboard")
    assert response.status_code == 401


async def test_dashboard_forbidden_for_member(member_user):
    async with _client_as(member_user) as client:
        response = await client.get("/api/v1/it-head/dashboard")
    assert response.status_code == 403


async def test_dashboard_has_the_right_shape(it_head_user):
    async with _client_as(it_head_user) as client:
        response = await client.get("/api/v1/it-head/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"stats", "fee_status"}
    assert set(body["stats"].keys()) == {
        "active_members",
        "open_issues",
        "pending_permissions",
        "fees_outstanding",
        "late_fines_outstanding",
    }


async def test_member_with_no_payment_shows_up_as_overdue_fee(it_head_user, member_user):
    async with _client_as(it_head_user) as client:
        response = await client.get("/api/v1/it-head/dashboard")

    entry = next(row for row in response.json()["fee_status"] if row["member_id"] == member_user.id)
    assert entry["status"] == "overdue"
    assert entry["amount_due"] > 0


async def test_member_with_active_plan_shows_up_as_paid(it_head_user, member_user):
    async with _client_as(member_user) as client:
        await client.post(
            "/api/v1/payments",
            json={"amount": 499, "label": "1 Month", "plan_months": 1},
        )

    async with _client_as(it_head_user) as client:
        response = await client.get("/api/v1/it-head/dashboard")

    entry = next(row for row in response.json()["fee_status"] if row["member_id"] == member_user.id)
    assert entry["status"] == "paid"
    assert entry["amount_due"] == 0


async def test_active_members_count_reflects_real_members(it_head_user, member_user):
    async with _client_as(it_head_user) as client:
        response = await client.get("/api/v1/it-head/dashboard")

    assert response.json()["stats"]["active_members"] >= 1


async def test_late_fines_outstanding_reflects_unpaid_overdue_loans(it_head_user, member_user):
    book = await prisma.book.create(
        data={
            "title": f"{TEST_BOOK_TITLE_PREFIX} {uuid.uuid4().hex[:8]}",
            "author": "Author",
            "category": "Fiction",
        }
    )
    await prisma.loan.create(
        data={
            "bookId": book.id,
            "memberId": member_user.id,
            "dueDate": datetime.now(UTC) - timedelta(days=4),
            "createdById": it_head_user.id,
        }
    )

    async with _client_as(it_head_user) as client:
        response = await client.get("/api/v1/it-head/dashboard")

    assert response.json()["stats"]["late_fines_outstanding"] >= 40
