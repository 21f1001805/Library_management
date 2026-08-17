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

TEST_EMAIL_DOMAIN = "@events-test.example.com"


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


async def _make_user(role_name: str):
    role = await member_repository.upsert_role(role_name)
    return await member_repository.create_member(
        email=_unique_email(),
        password_hash=None,
        full_name=f"Test {role_name.title()} {uuid.uuid4().hex[:6]}",
        phone=None,
        avatar_url=None,
        role_id=role.id,
    )


@pytest_asyncio.fixture(scope="module", autouse=True)
async def _db_connection():
    await prisma.connect()
    yield
    domain_filter = {"email": {"endswith": TEST_EMAIL_DOMAIN}}
    await prisma.eventmanagerassignment.delete_many(where={"manager": domain_filter})
    await prisma.eventregistration.delete_many(where={"member": domain_filter})
    await prisma.event.delete_many(where={"creator": domain_filter})
    await prisma.user.delete_many(where=domain_filter)
    await prisma.disconnect()


@pytest_asyncio.fixture
async def manager_user():
    return await _make_user(Role.MANAGER)


@pytest_asyncio.fixture
async def other_manager_user():
    return await _make_user(Role.MANAGER)


@pytest_asyncio.fixture
async def member_user():
    return await _make_user(Role.MEMBER)


@pytest_asyncio.fixture
async def it_head_user():
    return await _make_user(Role.IT_HEAD)


def _client_as(user) -> AsyncClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _future_date() -> str:
    return (datetime.now(UTC) + timedelta(days=7)).isoformat()


async def _create_event(manager_user, **overrides) -> dict:
    payload = {
        "title": "Test Event",
        "description": "A test event",
        "location": "Main Hall",
        "date": _future_date(),
        "capacity": 10,
    }
    payload.update(overrides)
    async with _client_as(manager_user) as client:
        response = await client.post("/api/v1/events", json=payload)
    return response.json()


async def test_member_cannot_create_an_event(member_user):
    async with _client_as(member_user) as client:
        response = await client.post(
            "/api/v1/events",
            json={"title": "x", "location": "y", "date": _future_date(), "capacity": 5},
        )
    assert response.status_code == 403


async def test_create_event_with_no_managers_has_empty_assignments(manager_user):
    body = await _create_event(manager_user)

    assert body["assigned_managers"] == []


async def test_create_event_assigns_valid_managers_including_self(
    manager_user, other_manager_user
):
    body = await _create_event(
        manager_user, manager_ids=[manager_user.id, other_manager_user.id]
    )

    assigned_ids = {m["id"] for m in body["assigned_managers"]}
    assert assigned_ids == {manager_user.id, other_manager_user.id}


async def test_create_event_can_assign_a_member_too(manager_user, member_user):
    body = await _create_event(manager_user, manager_ids=[manager_user.id, member_user.id])

    assigned_ids = {m["id"] for m in body["assigned_managers"]}
    assert assigned_ids == {manager_user.id, member_user.id}


async def test_create_event_drops_a_nonexistent_id(manager_user):
    body = await _create_event(manager_user, manager_ids=[manager_user.id, str(uuid.uuid4())])

    assigned_ids = {m["id"] for m in body["assigned_managers"]}
    assert assigned_ids == {manager_user.id}


async def test_update_event_replaces_manager_assignments(
    manager_user, other_manager_user
):
    created = await _create_event(manager_user, manager_ids=[manager_user.id])

    async with _client_as(manager_user) as client:
        response = await client.put(
            f"/api/v1/events/{created['id']}", json={"manager_ids": [other_manager_user.id]}
        )

    assert response.status_code == 200
    assigned_ids = {m["id"] for m in response.json()["assigned_managers"]}
    assert assigned_ids == {other_manager_user.id}


async def test_update_event_with_empty_manager_ids_clears_assignments(manager_user):
    created = await _create_event(manager_user, manager_ids=[manager_user.id])

    async with _client_as(manager_user) as client:
        response = await client.put(f"/api/v1/events/{created['id']}", json={"manager_ids": []})

    assert response.status_code == 200
    assert response.json()["assigned_managers"] == []


async def test_update_event_omitting_manager_ids_leaves_assignments_unchanged(manager_user):
    created = await _create_event(manager_user, manager_ids=[manager_user.id])

    async with _client_as(manager_user) as client:
        response = await client.put(
            f"/api/v1/events/{created['id']}", json={"title": "Renamed Event"}
        )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed Event"
    assigned_ids = {m["id"] for m in response.json()["assigned_managers"]}
    assert assigned_ids == {manager_user.id}


async def test_member_cannot_update_an_event(manager_user, member_user):
    created = await _create_event(manager_user)

    async with _client_as(member_user) as client:
        response = await client.put(f"/api/v1/events/{created['id']}", json={"title": "Hacked"})

    assert response.status_code == 403


async def test_get_event_includes_assigned_managers(manager_user):
    created = await _create_event(manager_user, manager_ids=[manager_user.id])

    async with _client_as(manager_user) as client:
        response = await client.get(f"/api/v1/events/{created['id']}")

    assert response.status_code == 200
    assigned_ids = {m["id"] for m in response.json()["assigned_managers"]}
    assert assigned_ids == {manager_user.id}


async def test_it_head_can_remove_a_registrant(manager_user, member_user, it_head_user):
    created = await _create_event(manager_user)

    async with _client_as(member_user) as client:
        await client.post(f"/api/v1/events/{created['id']}/register")

    async with _client_as(it_head_user) as client:
        response = await client.delete(
            f"/api/v1/events/{created['id']}/registrants/{member_user.id}"
        )

    assert response.status_code == 200
    registrant_ids = {r["id"] for r in response.json()["registrants"]}
    assert member_user.id not in registrant_ids

    # Persists — a plain re-fetch (not just the mutation response) confirms this
    # wasn't an optimistic-only update that reverts on reload.
    async with _client_as(manager_user) as client:
        refetched = await client.get(f"/api/v1/events/{created['id']}")
    refetched_ids = {r["id"] for r in refetched.json()["registrants"]}
    assert member_user.id not in refetched_ids


async def test_manager_cannot_remove_a_registrant(manager_user, member_user):
    created = await _create_event(manager_user)

    async with _client_as(member_user) as client:
        await client.post(f"/api/v1/events/{created['id']}/register")

    async with _client_as(manager_user) as client:
        response = await client.delete(
            f"/api/v1/events/{created['id']}/registrants/{member_user.id}"
        )

    assert response.status_code == 403


async def test_removing_a_non_registrant_is_404(member_user, it_head_user):
    created = await _create_event(await _make_user(Role.MANAGER))

    async with _client_as(it_head_user) as client:
        response = await client.delete(
            f"/api/v1/events/{created['id']}/registrants/{member_user.id}"
        )

    assert response.status_code == 404
