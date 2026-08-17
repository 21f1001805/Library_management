import os
import uuid

os.environ["APP_ENV"] = "test"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.constants import Role
from app.core.security import hash_password
from app.db.prisma import prisma
from app.main import create_app
from app.modules.members import repository

os.environ.setdefault("DATABASE_URL", get_settings().database_url)

TEST_EMAIL_DOMAIN = "@members-test.example.com"


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


async def _make_user(role_name: str):
    role = await repository.upsert_role(role_name)
    return await repository.create_member(
        email=_unique_email(),
        password_hash=hash_password("Password123!"),
        full_name=f"Test {role_name.title()}",
        phone=None,
        avatar_url=None,
        role_id=role.id,
    )


@pytest_asyncio.fixture(scope="module", autouse=True)
async def _db_connection():
    await prisma.connect()
    yield
    await prisma.user.delete_many(where={"email": {"endswith": TEST_EMAIL_DOMAIN}})
    await prisma.disconnect()


@pytest_asyncio.fixture
async def admin_user():
    return await _make_user(Role.ADMIN)


@pytest_asyncio.fixture
async def member_user():
    return await _make_user(Role.MEMBER)


def _client_as(user) -> AsyncClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_list_members_requires_authentication():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/members")

    assert response.status_code == 401


async def test_list_members_forbidden_for_member_role(member_user):
    async with _client_as(member_user) as client:
        response = await client.get("/api/v1/members")

    assert response.status_code == 403


async def test_create_member_defaults_to_member_role(admin_user):
    email = _unique_email()
    async with _client_as(admin_user) as client:
        response = await client.post(
            "/api/v1/members",
            json={"email": email, "password": "Password123!", "full_name": "Walk-in Visitor"},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == email
    assert body["full_name"] == "Walk-in Visitor"
    assert body["role"]["name"] == Role.MEMBER
    assert body["is_active"] is True
    assert "password" not in body
    assert "password_hash" not in body


async def test_create_member_duplicate_email_conflicts(admin_user):
    email = _unique_email()
    payload = {"email": email, "password": "Password123!", "full_name": "Duplicate Test"}

    async with _client_as(admin_user) as client:
        first = await client.post("/api/v1/members", json=payload)
        second = await client.post("/api/v1/members", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409


async def test_list_members_search_and_pagination(admin_user):
    unique_marker = uuid.uuid4().hex[:8]
    async with _client_as(admin_user) as client:
        for i in range(3):
            await client.post(
                "/api/v1/members",
                json={
                    "email": _unique_email(),
                    "password": "Password123!",
                    "full_name": f"Searchable-{unique_marker}-{i}",
                },
            )

        response = await client.get(
            "/api/v1/members", params={"search": unique_marker, "page": 1, "page_size": 2}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert all(unique_marker in item["full_name"] for item in body["items"])


async def test_list_members_filters_by_role(admin_user):
    unique_marker = uuid.uuid4().hex[:8]
    guardian_role = await repository.upsert_role(Role.GUARDIAN)
    await repository.create_member(
        email=_unique_email(),
        password_hash=None,
        full_name=f"Guardian-{unique_marker}",
        phone=None,
        avatar_url=None,
        role_id=guardian_role.id,
    )

    async with _client_as(admin_user) as client:
        await client.post(
            "/api/v1/members",
            json={
                "email": _unique_email(),
                "password": "Password123!",
                "full_name": f"Member-{unique_marker}",
            },
        )
        response = await client.get(
            "/api/v1/members", params={"search": unique_marker, "role": Role.GUARDIAN}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["role"]["name"] == Role.GUARDIAN


async def test_list_members_active_only_excludes_inactive_accounts(admin_user):
    unique_marker = uuid.uuid4().hex[:8]
    async with _client_as(admin_user) as client:
        created = await client.post(
            "/api/v1/members",
            json={
                "email": _unique_email(),
                "password": "Password123!",
                "full_name": f"Inactive-{unique_marker}",
            },
        )
        await client.put(
            f"/api/v1/members/{created.json()['id']}", json={"is_active": False}
        )

        response = await client.get(
            "/api/v1/members", params={"search": unique_marker, "active_only": True}
        )

    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_update_member_changes_fields(admin_user):
    async with _client_as(admin_user) as client:
        created = await client.post(
            "/api/v1/members",
            json={
                "email": _unique_email(),
                "password": "Password123!",
                "full_name": "Before Update",
            },
        )
        member_id = created.json()["id"]

        response = await client.put(
            f"/api/v1/members/{member_id}",
            json={"full_name": "After Update", "is_active": False},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "After Update"
    assert body["is_active"] is False


async def test_update_member_not_found(admin_user):
    async with _client_as(admin_user) as client:
        response = await client.put(
            f"/api/v1/members/{uuid.uuid4()}",
            json={"full_name": "Nobody"},
        )

    assert response.status_code == 404


async def test_update_member_rejects_malformed_id(admin_user):
    async with _client_as(admin_user) as client:
        response = await client.put(
            "/api/v1/members/not-a-uuid",
            json={"full_name": "Nobody"},
        )

    assert response.status_code == 422


async def test_update_member_can_clear_nullable_fields(admin_user):
    async with _client_as(admin_user) as client:
        created = await client.post(
            "/api/v1/members",
            json={
                "email": _unique_email(),
                "password": "Password123!",
                "full_name": "Has Phone",
                "phone": "+911234567890",
            },
        )
        member_id = created.json()["id"]
        assert created.json()["phone"] == "+911234567890"

        response = await client.put(
            f"/api/v1/members/{member_id}",
            json={"phone": None},
        )

    assert response.status_code == 200
    assert response.json()["phone"] is None
