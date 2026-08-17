import os
import uuid

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

TEST_EMAIL_DOMAIN = "@payments-test.example.com"


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


@pytest_asyncio.fixture(scope="module", autouse=True)
async def _db_connection():
    await prisma.connect()
    yield
    domain_filter = {"email": {"endswith": TEST_EMAIL_DOMAIN}}
    await prisma.payment.delete_many(where={"user": domain_filter})
    await prisma.auditlogentry.delete_many(where={"actor": domain_filter})
    await prisma.coupon.delete_many(where={"createdBy": domain_filter})
    await prisma.user.delete_many(where=domain_filter)
    await prisma.disconnect()


@pytest_asyncio.fixture
async def member_user():
    role = await repository.upsert_role(Role.MEMBER)
    return await repository.create_member(
        email=_unique_email(),
        password_hash=hash_password("Password123!"),
        full_name="Payer",
        phone=None,
        avatar_url=None,
        role_id=role.id,
    )


@pytest_asyncio.fixture
async def admin_user():
    role = await repository.upsert_role(Role.ADMIN)
    return await repository.create_member(
        email=_unique_email(),
        password_hash=hash_password("Password123!"),
        full_name="Coupon Admin",
        phone=None,
        avatar_url=None,
        role_id=role.id,
    )


@pytest_asyncio.fixture
async def client():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


async def test_create_payment_requires_authentication(client):
    response = await client.post("/api/v1/payments", json={"amount": 499, "label": "1 Month"})

    assert response.status_code == 401


async def test_create_payment_records_it_for_the_current_user(client, member_user):
    login = await client.post(
        "/api/v1/auth/login", json={"email": member_user.email, "password": "Password123!"}
    )
    token = login.json()["access_token"]

    response = await client.post(
        "/api/v1/payments",
        json={"amount": 499, "label": "1 Month — ₹499"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["amount"] == 499
    assert body["label"] == "1 Month — ₹499"
    assert body["status"] == "success"


async def test_create_payment_rejects_non_positive_amount(client, member_user):
    login = await client.post(
        "/api/v1/auth/login", json={"email": member_user.email, "password": "Password123!"}
    )
    token = login.json()["access_token"]

    response = await client.post(
        "/api/v1/payments",
        json={"amount": 0, "label": "Free?"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


async def test_list_my_payments_requires_authentication(client):
    response = await client.get("/api/v1/payments/me")

    assert response.status_code == 401


async def test_list_my_payments_returns_only_the_caller_s_own_payments(
    client, member_user, admin_user
):
    member_headers = await _login(client, member_user)
    admin_headers = await _login(client, admin_user)

    await client.post(
        "/api/v1/payments", json={"amount": 499, "label": "1 Month"}, headers=member_headers
    )
    await client.post(
        "/api/v1/payments", json={"amount": 999, "label": "3 Months"}, headers=admin_headers
    )

    response = await client.get("/api/v1/payments/me", headers=member_headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["amount"] == 499
    assert body[0]["label"] == "1 Month"


async def test_list_my_payments_orders_newest_first(client, member_user):
    member_headers = await _login(client, member_user)

    await client.post(
        "/api/v1/payments", json={"amount": 100, "label": "First"}, headers=member_headers
    )
    await client.post(
        "/api/v1/payments", json={"amount": 200, "label": "Second"}, headers=member_headers
    )

    response = await client.get("/api/v1/payments/me", headers=member_headers)

    labels = [p["label"] for p in response.json()]
    assert labels.index("Second") < labels.index("First")


async def test_membership_requires_authentication(client):
    response = await client.get("/api/v1/payments/me/membership")

    assert response.status_code == 401


async def test_membership_is_null_with_no_plan_payments(client, member_user):
    login = await client.post(
        "/api/v1/auth/login", json={"email": member_user.email, "password": "Password123!"}
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/payments/me/membership", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json() is None


async def test_membership_ignores_fine_payments_without_plan_months(client, member_user):
    login = await client.post(
        "/api/v1/auth/login", json={"email": member_user.email, "password": "Password123!"}
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/api/v1/payments", json={"amount": 15, "label": "Fine owed"}, headers=headers
    )

    response = await client.get("/api/v1/payments/me/membership", headers=headers)

    assert response.status_code == 200
    assert response.json() is None


async def test_membership_reflects_latest_plan_payment(client, member_user):
    login = await client.post(
        "/api/v1/auth/login", json={"email": member_user.email, "password": "Password123!"}
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/api/v1/payments",
        json={"amount": 499, "label": "1 Month — ₹499", "plan_months": 1},
        headers=headers,
    )

    response = await client.get("/api/v1/payments/me/membership", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["plan_label"] == "1 Month — ₹499"
    assert body["is_active"] is True


@pytest_asyncio.fixture
async def manager_user():
    role = await repository.upsert_role(Role.MANAGER)
    return await repository.create_member(
        email=_unique_email(),
        password_hash=hash_password("Password123!"),
        full_name="Front Desk Manager",
        phone=None,
        avatar_url=None,
        role_id=role.id,
    )


async def test_pay_at_library_notifies_managers(client, member_user, manager_user):
    login = await client.post(
        "/api/v1/auth/login", json={"email": member_user.email, "password": "Password123!"}
    )
    token = login.json()["access_token"]

    response = await client.post(
        "/api/v1/payments/pay-at-library",
        json={"amount": 150, "label": "Overdue fine"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 204
    notification = await prisma.notification.find_first(
        where={"userId": manager_user.id, "type": "payment-pending"}
    )
    assert notification is not None
    assert member_user.fullName in notification.message
    assert "150" in notification.message


async def _login(client, user) -> dict:
    login = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "Password123!"}
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _generate_coupon(client, headers, discount_percent=20, max_uses=1) -> dict:
    response = await client.post(
        "/api/v1/coupons",
        json={"discount_percent": discount_percent, "max_uses": max_uses},
        headers=headers,
    )
    return response.json()


async def test_payment_with_a_valid_coupon_applies_the_discount(client, member_user, admin_user):
    admin_headers = await _login(client, admin_user)
    coupon = await _generate_coupon(client, admin_headers, discount_percent=20, max_uses=1)
    member_headers = await _login(client, member_user)

    response = await client.post(
        "/api/v1/payments",
        json={"amount": 500, "label": "Test", "coupon_code": coupon["code"]},
        headers=member_headers,
    )

    assert response.status_code == 201
    assert response.json()["amount"] == 400

    listed = await client.get("/api/v1/coupons", headers=admin_headers)
    updated = next(c for c in listed.json() if c["code"] == coupon["code"])
    assert updated["uses_count"] == 1


async def test_payment_with_an_unknown_coupon_code_fails(client, member_user):
    member_headers = await _login(client, member_user)

    response = await client.post(
        "/api/v1/payments",
        json={"amount": 500, "label": "Test", "coupon_code": "NOSUCHCODE"},
        headers=member_headers,
    )

    assert response.status_code == 404


async def test_payment_with_an_exhausted_coupon_fails(client, member_user, admin_user):
    admin_headers = await _login(client, admin_user)
    coupon = await _generate_coupon(client, admin_headers, discount_percent=10, max_uses=1)
    member_headers = await _login(client, member_user)

    first = await client.post(
        "/api/v1/payments",
        json={"amount": 100, "label": "Test", "coupon_code": coupon["code"]},
        headers=member_headers,
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/v1/payments",
        json={"amount": 100, "label": "Test", "coupon_code": coupon["code"]},
        headers=member_headers,
    )
    assert second.status_code == 409
