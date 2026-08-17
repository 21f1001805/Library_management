import os
import uuid
from datetime import UTC, datetime, timedelta

os.environ["APP_ENV"] = "test"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.constants import Role
from app.core.security import hash_password
from app.db.prisma import prisma
from app.main import create_app
from app.modules.members import repository

os.environ.setdefault("DATABASE_URL", get_settings().database_url)

TEST_EMAIL_DOMAIN = "@guardian-test.example.com"


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


@pytest_asyncio.fixture(scope="module", autouse=True)
async def _db_connection():
    await prisma.connect()
    yield
    domain_filter = {"email": {"endswith": TEST_EMAIL_DOMAIN}}
    await prisma.readingprogress.delete_many(where={"member": domain_filter})
    await prisma.guardianlink.delete_many(where={"member": domain_filter})
    await prisma.loan.delete_many(where={"member": domain_filter})
    await prisma.payment.delete_many(where={"user": domain_filter})
    await prisma.notification.delete_many(where={"user": domain_filter})
    await prisma.seatbooking.delete_many(where={"member": domain_filter})
    await prisma.seatnotifyrequest.delete_many(where={"member": domain_filter})
    await prisma.book.delete_many(where={"title": {"startswith": "Guardian Test Book"}})
    await prisma.user.delete_many(where=domain_filter)
    await prisma.disconnect()


@pytest_asyncio.fixture
async def client():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


async def _make_user(role_name: str) -> object:
    role = await repository.upsert_role(role_name)
    return await repository.create_member(
        email=_unique_email(),
        password_hash=hash_password("Password123!"),
        full_name=f"{role_name.title()} User",
        phone=None,
        avatar_url=None,
        role_id=role.id,
    )


async def _login(client: AsyncClient, user) -> str:
    response = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "Password123!"}
    )
    return response.json()["access_token"]


async def test_member_cannot_have_two_guardians(client):
    admin = await _make_user(Role.ADMIN)
    guardian_one = await _make_user(Role.GUARDIAN)
    guardian_two = await _make_user(Role.GUARDIAN)
    member = await _make_user(Role.MEMBER)
    admin_token = await _login(client, admin)
    headers = {"Authorization": f"Bearer {admin_token}"}

    first = await client.post(
        "/api/v1/guardian/links",
        json={"guardian_id": guardian_one.id, "member_id": member.id},
        headers=headers,
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/v1/guardian/links",
        json={"guardian_id": guardian_two.id, "member_id": member.id},
        headers=headers,
    )
    assert second.status_code == 409


async def test_guardian_sees_linked_member_reading_progress(client):
    admin = await _make_user(Role.ADMIN)
    guardian = await _make_user(Role.GUARDIAN)
    member = await _make_user(Role.MEMBER)
    admin_token = await _login(client, admin)

    await client.post(
        "/api/v1/guardian/links",
        json={"guardian_id": guardian.id, "member_id": member.id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    book = await prisma.book.create(
        data={"title": "Guardian Test Book", "author": "Test Author", "category": "Fiction"}
    )
    member_token = await _login(client, member)
    await client.put(
        "/api/v1/members/me/reading-progress",
        json={"book_id": book.id, "status": "reading", "percent_complete": 40},
        headers={"Authorization": f"Bearer {member_token}"},
    )

    guardian_token = await _login(client, guardian)
    response = await client.get(
        "/api/v1/guardian/children", headers={"Authorization": f"Bearer {guardian_token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == member.id
    assert len(body[0]["currently_reading"]) == 1
    assert body[0]["currently_reading"][0]["book_title"] == "Guardian Test Book"
    assert body[0]["currently_reading"][0]["percent_complete"] == 40
    assert body[0]["completed"] == []


async def test_guardian_children_requires_guardian_role(client):
    member = await _make_user(Role.MEMBER)
    token = await _login(client, member)

    response = await client.get(
        "/api/v1/guardian/children", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403


async def _link(client, admin_token, guardian, member):
    await client.post(
        "/api/v1/guardian/links",
        json={"guardian_id": guardian.id, "member_id": member.id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )


async def test_pay_child_fines_clears_overdue_loan_and_pays(client):
    admin = await _make_user(Role.ADMIN)
    guardian = await _make_user(Role.GUARDIAN)
    child = await _make_user(Role.MEMBER)
    admin_token = await _login(client, admin)
    await _link(client, admin_token, guardian, child)

    book = await prisma.book.create(
        data={"title": "Guardian Test Book Fines", "author": "A", "category": "Fiction"}
    )
    loan = await prisma.loan.create(
        data={
            "bookId": book.id,
            "memberId": child.id,
            "dueDate": datetime.now(UTC) - timedelta(days=3),
            "createdById": admin.id,
        }
    )

    guardian_token = await _login(client, guardian)
    children_before = await client.get(
        "/api/v1/guardian/children", headers={"Authorization": f"Bearer {guardian_token}"}
    )
    child_out = next(c for c in children_before.json() if c["id"] == child.id)
    assert child_out["outstanding_fine"] > 0
    assert child_out["fine_book_title"] == "Guardian Test Book Fines"

    response = await client.post(
        f"/api/v1/guardian/children/{child.id}/pay-fines",
        headers={"Authorization": f"Bearer {guardian_token}"},
    )
    assert response.status_code == 204

    updated_loan = await prisma.loan.find_unique(where={"id": loan.id})
    assert updated_loan.finePaid is True

    children_after = await client.get(
        "/api/v1/guardian/children", headers={"Authorization": f"Bearer {guardian_token}"}
    )
    child_out_after = next(c for c in children_after.json() if c["id"] == child.id)
    assert child_out_after["outstanding_fine"] == 0


async def test_pay_child_fines_with_no_fines_returns_400(client):
    admin = await _make_user(Role.ADMIN)
    guardian = await _make_user(Role.GUARDIAN)
    child = await _make_user(Role.MEMBER)
    admin_token = await _login(client, admin)
    await _link(client, admin_token, guardian, child)
    guardian_token = await _login(client, guardian)

    response = await client.post(
        f"/api/v1/guardian/children/{child.id}/pay-fines",
        headers={"Authorization": f"Bearer {guardian_token}"},
    )
    assert response.status_code == 400


async def test_pay_child_fines_rejects_unlinked_child(client):
    guardian = await _make_user(Role.GUARDIAN)
    stranger = await _make_user(Role.MEMBER)
    guardian_token = await _login(client, guardian)

    response = await client.post(
        f"/api/v1/guardian/children/{stranger.id}/pay-fines",
        headers={"Authorization": f"Bearer {guardian_token}"},
    )
    assert response.status_code == 403


async def test_renew_child_subscription_creates_membership_payment(client):
    admin = await _make_user(Role.ADMIN)
    guardian = await _make_user(Role.GUARDIAN)
    child = await _make_user(Role.MEMBER)
    admin_token = await _login(client, admin)
    await _link(client, admin_token, guardian, child)
    guardian_token = await _login(client, guardian)

    response = await client.post(
        f"/api/v1/guardian/children/{child.id}/renew",
        headers={"Authorization": f"Bearer {guardian_token}"},
    )
    assert response.status_code == 204

    payment = await prisma.payment.find_first(where={"userId": child.id, "planMonths": 1})
    assert payment is not None
    assert payment.amount == 499


async def test_book_seat_for_child(client):
    admin = await _make_user(Role.ADMIN)
    guardian = await _make_user(Role.GUARDIAN)
    child = await _make_user(Role.MEMBER)
    admin_token = await _login(client, admin)
    await _link(client, admin_token, guardian, child)
    guardian_token = await _login(client, guardian)

    tomorrow = (datetime.now(UTC) + timedelta(days=1)).date()
    response = await client.post(
        f"/api/v1/guardian/children/{child.id}/seat-bookings",
        json={"seat_label": "A1", "date": tomorrow.isoformat(), "hour": 10},
        headers={"Authorization": f"Bearer {guardian_token}"},
    )

    assert response.status_code == 201
    booking = await prisma.seatbooking.find_first(where={"memberId": child.id})
    assert booking is not None
    assert booking.seatLabel == "A1"


async def test_seat_booking_for_child_rejects_unlinked_child(client):
    guardian = await _make_user(Role.GUARDIAN)
    stranger = await _make_user(Role.MEMBER)
    guardian_token = await _login(client, guardian)

    tomorrow = (datetime.now(UTC) + timedelta(days=1)).date()
    response = await client.post(
        f"/api/v1/guardian/children/{stranger.id}/seat-bookings",
        json={"seat_label": "A2", "date": tomorrow.isoformat(), "hour": 10},
        headers={"Authorization": f"Bearer {guardian_token}"},
    )

    assert response.status_code == 403
