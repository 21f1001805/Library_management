import os
import uuid
from datetime import UTC, datetime, timedelta

os.environ["APP_ENV"] = "test"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.constants import Role
from app.db.prisma import prisma
from app.main import create_app
from app.modules.members import repository as member_repository

os.environ.setdefault("DATABASE_URL", get_settings().database_url)

TEST_EMAIL_DOMAIN = "@manager-test.example.com"
TEST_TITLE_MARKER = "MANAGER-TEST-"
TOMORROW = (datetime.now(UTC) + timedelta(days=1)).date().isoformat()


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


def _book_payload(**overrides) -> dict:
    payload = {
        "title": f"{TEST_TITLE_MARKER}{uuid.uuid4().hex}",
        "author": "Test Author",
        "category": "Fiction",
        "total_copies": 1,
    }
    payload.update(overrides)
    return payload


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
    await prisma.notification.delete_many(where={"user": domain_filter})
    await prisma.guardianlink.delete_many(where={"guardian": domain_filter})
    await prisma.loan.delete_many(where={"member": domain_filter})
    await prisma.reservation.delete_many(where={"member": domain_filter})
    await prisma.seatbooking.delete_many(where={"member": domain_filter})
    await prisma.book.delete_many(where={"title": {"startswith": TEST_TITLE_MARKER}})
    await prisma.user.delete_many(where=domain_filter)
    await prisma.disconnect()


@pytest_asyncio.fixture
async def manager_user():
    return await _make_user(Role.MANAGER)


@pytest_asyncio.fixture
async def member_user():
    return await _make_user(Role.MEMBER)


@pytest_asyncio.fixture
async def guardian_user():
    return await _make_user(Role.GUARDIAN)


def _client_as(user) -> AsyncClient:
    from app.api.deps import get_current_user

    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _create_book(manager_user, **overrides) -> str:
    async with _client_as(manager_user) as client:
        response = await client.post("/api/v1/books", json=_book_payload(**overrides))
    return response.json()["id"]


async def test_dashboard_requires_authentication():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/manager/dashboard")

    assert response.status_code == 401


async def test_member_cannot_view_dashboard(member_user):
    async with _client_as(member_user) as client:
        response = await client.get("/api/v1/manager/dashboard")

    assert response.status_code == 403


async def test_manager_can_view_dashboard_stats(manager_user):
    async with _client_as(manager_user) as client:
        response = await client.get("/api/v1/manager/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "seats_booked_today",
        "books_issued_today",
        "new_registrations_today",
        "pending_tasks",
    }
    assert all(isinstance(value, int) for value in body.values())


async def test_dashboard_counts_todays_new_registrations(manager_user):
    async with _client_as(manager_user) as client:
        before = await client.get("/api/v1/manager/dashboard")
        await _make_user(Role.MEMBER)
        after = await client.get("/api/v1/manager/dashboard")

    assert after.json()["new_registrations_today"] == before.json()["new_registrations_today"] + 1


async def test_dashboard_counts_todays_issued_loans(manager_user, member_user):
    book_id = await _create_book(manager_user)

    async with _client_as(manager_user) as client:
        before = await client.get("/api/v1/manager/dashboard")
        await client.post(
            "/api/v1/manager/loans",
            json={"member_id": member_user.id, "book_id": book_id, "duration_days": 3},
        )
        after = await client.get("/api/v1/manager/dashboard")

    assert after.json()["books_issued_today"] == before.json()["books_issued_today"] + 1


async def test_dashboard_counts_pending_reservations_as_pending_tasks(manager_user, member_user):
    book_id = await _create_book(manager_user)

    async with _client_as(manager_user) as client:
        before = await client.get("/api/v1/manager/dashboard")

    async with _client_as(member_user) as client:
        await client.post("/api/v1/reservations", json={"book_id": book_id})

    async with _client_as(manager_user) as client:
        after = await client.get("/api/v1/manager/dashboard")

    assert after.json()["pending_tasks"] == before.json()["pending_tasks"] + 1


async def test_manager_can_book_a_seat_for_a_member(manager_user, member_user):
    async with _client_as(manager_user) as client:
        response = await client.post(
            "/api/v1/manager/seat-bookings",
            json={"member_id": member_user.id, "seat_label": "A1", "date": TOMORROW, "hour": 10},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["seat_label"] == "A1"
    assert body["date"] == TOMORROW
    assert body["hour"] == 10


async def test_member_cannot_book_a_seat_for_another_member(manager_user, member_user):
    async with _client_as(member_user) as client:
        response = await client.post(
            "/api/v1/manager/seat-bookings",
            json={"member_id": member_user.id, "seat_label": "A2", "date": TOMORROW, "hour": 10},
        )

    assert response.status_code == 403


async def test_booking_a_seat_twice_for_the_same_slot_conflicts(manager_user, member_user):
    async with _client_as(manager_user) as client:
        await client.post(
            "/api/v1/manager/seat-bookings",
            json={"member_id": member_user.id, "seat_label": "A3", "date": TOMORROW, "hour": 11},
        )
        response = await client.post(
            "/api/v1/manager/seat-bookings",
            json={"member_id": member_user.id, "seat_label": "A3", "date": TOMORROW, "hour": 11},
        )

    assert response.status_code == 409


async def test_booking_a_seat_for_missing_member_returns_404(manager_user):
    async with _client_as(manager_user) as client:
        response = await client.post(
            "/api/v1/manager/seat-bookings",
            json={
                "member_id": str(uuid.uuid4()),
                "seat_label": "A4",
                "date": TOMORROW,
                "hour": 12,
            },
        )

    assert response.status_code == 404


async def test_manager_can_issue_a_book_for_a_member(manager_user, member_user):
    book_id = await _create_book(manager_user)

    async with _client_as(manager_user) as client:
        response = await client.post(
            "/api/v1/manager/loans",
            json={"member_id": member_user.id, "book_id": book_id, "duration_days": 7},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["book_id"] == book_id
    assert body["status"] == "active"


async def test_issuing_rejects_a_duration_outside_the_allowed_choices(manager_user, member_user):
    book_id = await _create_book(manager_user)

    async with _client_as(manager_user) as client:
        response = await client.post(
            "/api/v1/manager/loans",
            json={"member_id": member_user.id, "book_id": book_id, "duration_days": 4},
        )

    assert response.status_code == 422


async def test_issuing_a_book_for_missing_member_returns_404(manager_user):
    book_id = await _create_book(manager_user)

    async with _client_as(manager_user) as client:
        response = await client.post(
            "/api/v1/manager/loans",
            json={"member_id": str(uuid.uuid4()), "book_id": book_id, "duration_days": 3},
        )

    assert response.status_code == 404


async def _request_reservation(member_user, book_id: str) -> str:
    async with _client_as(member_user) as client:
        response = await client.post("/api/v1/reservations", json={"book_id": book_id})
    return response.json()["id"]


async def test_pending_reservations_requires_manager(member_user):
    async with _client_as(member_user) as client:
        response = await client.get("/api/v1/manager/reservations/pending")

    assert response.status_code == 403


async def test_manager_sees_a_pending_reservation_request(manager_user, member_user):
    book_id = await _create_book(manager_user)
    reservation_id = await _request_reservation(member_user, book_id)

    async with _client_as(manager_user) as client:
        response = await client.get("/api/v1/manager/reservations/pending")

    assert response.status_code == 200
    entry = next(row for row in response.json() if row["id"] == reservation_id)
    assert entry["book_id"] == book_id
    assert entry["member_id"] == member_user.id
    assert entry["member_name"] == member_user.fullName


async def test_approving_a_reservation_creates_a_loan_with_the_chosen_duration(
    manager_user, member_user
):
    book_id = await _create_book(manager_user)
    reservation_id = await _request_reservation(member_user, book_id)

    async with _client_as(manager_user) as client:
        response = await client.post(
            f"/api/v1/manager/reservations/{reservation_id}/approve",
            json={"duration_days": 5},
        )
        pending_after = await client.get("/api/v1/manager/reservations/pending")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["due_date"] is not None
    approved_due = datetime.fromisoformat(body["due_date"].replace("Z", "+00:00"))
    assert 4 <= (approved_due - datetime.now(UTC)).days <= 5
    assert not any(row["id"] == reservation_id for row in pending_after.json())


async def test_approving_rejects_an_out_of_range_duration(manager_user, member_user):
    book_id = await _create_book(manager_user)
    reservation_id = await _request_reservation(member_user, book_id)

    async with _client_as(manager_user) as client:
        response = await client.post(
            f"/api/v1/manager/reservations/{reservation_id}/approve",
            json={"duration_days": 1},
        )

    assert response.status_code == 422


async def test_approving_when_no_copies_remain_conflicts(manager_user, member_user):
    book_id = await _create_book(manager_user, total_copies=1)
    other_member = await _make_user(Role.MEMBER)
    reservation_id = await _request_reservation(member_user, book_id)

    async with _client_as(manager_user) as client:
        # Direct-issue the only copy out from under the pending request.
        await client.post(
            "/api/v1/manager/loans",
            json={"member_id": other_member.id, "book_id": book_id, "duration_days": 3},
        )
        response = await client.post(
            f"/api/v1/manager/reservations/{reservation_id}/approve",
            json={"duration_days": 3},
        )

    assert response.status_code == 409


async def test_approving_notifies_the_requesting_member(manager_user, member_user):
    book_id = await _create_book(manager_user)
    reservation_id = await _request_reservation(member_user, book_id)

    async with _client_as(manager_user) as client:
        await client.post(
            f"/api/v1/manager/reservations/{reservation_id}/approve",
            json={"duration_days": 3},
        )

    async with _client_as(member_user) as client:
        notifications = await client.get("/api/v1/notifications/me")

    assert any(n["type"] == "reservation-approved" for n in notifications.json())


async def test_rejecting_a_reservation_notifies_the_member_and_leaves_it_out_of_the_queue(
    manager_user, member_user
):
    book_id = await _create_book(manager_user)
    reservation_id = await _request_reservation(member_user, book_id)

    async with _client_as(manager_user) as client:
        response = await client.post(f"/api/v1/manager/reservations/{reservation_id}/reject")
        pending_after = await client.get("/api/v1/manager/reservations/pending")

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert not any(row["id"] == reservation_id for row in pending_after.json())

    async with _client_as(member_user) as client:
        notifications = await client.get("/api/v1/notifications/me")

    assert any(n["type"] == "reservation-rejected" for n in notifications.json())


async def test_approving_an_already_decided_reservation_is_not_found(manager_user, member_user):
    book_id = await _create_book(manager_user)
    reservation_id = await _request_reservation(member_user, book_id)

    async with _client_as(manager_user) as client:
        await client.post(f"/api/v1/manager/reservations/{reservation_id}/reject")
        response = await client.post(
            f"/api/v1/manager/reservations/{reservation_id}/approve",
            json={"duration_days": 3},
        )

    assert response.status_code == 404


async def test_manager_can_link_a_guardian_by_email(manager_user, member_user, guardian_user):
    async with _client_as(manager_user) as client:
        response = await client.post(
            "/api/v1/manager/guardian-links",
            json={"student_email": member_user.email, "guardian_email": guardian_user.email},
        )

    assert response.status_code == 204


async def test_linking_a_guardian_with_unknown_email_returns_404(manager_user, member_user):
    async with _client_as(manager_user) as client:
        response = await client.post(
            "/api/v1/manager/guardian-links",
            json={"student_email": member_user.email, "guardian_email": _unique_email()},
        )

    assert response.status_code == 404


async def test_linking_a_second_guardian_to_the_same_member_conflicts(
    manager_user, member_user, guardian_user
):
    other_guardian = await _make_user(Role.GUARDIAN)

    async with _client_as(manager_user) as client:
        await client.post(
            "/api/v1/manager/guardian-links",
            json={"student_email": member_user.email, "guardian_email": guardian_user.email},
        )
        response = await client.post(
            "/api/v1/manager/guardian-links",
            json={"student_email": member_user.email, "guardian_email": other_guardian.email},
        )

    assert response.status_code == 409


async def test_books_endpoint_requires_authentication():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/manager/books")

    assert response.status_code == 401


async def test_member_cannot_view_book_availability(member_user):
    async with _client_as(member_user) as client:
        response = await client.get("/api/v1/manager/books")

    assert response.status_code == 403


async def test_book_with_free_copies_is_available(manager_user):
    book_id = await _create_book(manager_user, total_copies=2)

    async with _client_as(manager_user) as client:
        response = await client.get("/api/v1/manager/books", params={"search": TEST_TITLE_MARKER})

    assert response.status_code == 200
    entry = next(item for item in response.json()["items"] if item["id"] == book_id)
    assert entry["total_copies"] == 2
    assert entry["available_copies"] == 2
    assert entry["is_available"] is True
    assert entry["expected_available_at"] is None


async def test_fully_loaned_book_reports_earliest_due_date_as_expected_available(
    manager_user, member_user
):
    book_id = await _create_book(manager_user, total_copies=1)
    # Postgres truncates timestamp precision below milliseconds, so seed with
    # microsecond=0 to make the round-tripped value compare equal exactly.
    due_date = (datetime.now(UTC) + timedelta(days=5)).replace(microsecond=0)
    await prisma.loan.create(
        data={
            "bookId": book_id,
            "memberId": member_user.id,
            "dueDate": due_date,
            "createdById": manager_user.id,
        }
    )

    async with _client_as(manager_user) as client:
        response = await client.get("/api/v1/manager/books", params={"search": TEST_TITLE_MARKER})

    entry = next(item for item in response.json()["items"] if item["id"] == book_id)
    assert entry["available_copies"] == 0
    assert entry["is_available"] is False
    assert entry["expected_available_at"] == due_date.isoformat().replace("+00:00", "Z")


async def test_book_availability_picks_the_earliest_due_date_among_active_loans(
    manager_user, member_user
):
    book_id = await _create_book(manager_user, total_copies=1)
    other_member = await _make_user(Role.MEMBER)
    later_due = (datetime.now(UTC) + timedelta(days=10)).replace(microsecond=0)
    sooner_due = (datetime.now(UTC) + timedelta(days=2)).replace(microsecond=0)
    await prisma.loan.create(
        data={
            "bookId": book_id,
            "memberId": member_user.id,
            "dueDate": later_due,
            "createdById": manager_user.id,
        }
    )
    await prisma.loan.create(
        data={
            "bookId": book_id,
            "memberId": other_member.id,
            "dueDate": sooner_due,
            "createdById": manager_user.id,
        }
    )

    async with _client_as(manager_user) as client:
        response = await client.get("/api/v1/manager/books", params={"search": TEST_TITLE_MARKER})

    entry = next(item for item in response.json()["items"] if item["id"] == book_id)
    assert entry["expected_available_at"] == sooner_due.isoformat().replace("+00:00", "Z")


async def test_returned_loans_do_not_count_against_availability(manager_user, member_user):
    book_id = await _create_book(manager_user, total_copies=1)
    await prisma.loan.create(
        data={
            "bookId": book_id,
            "memberId": member_user.id,
            "dueDate": datetime.now(UTC) - timedelta(days=1),
            "returnedAt": datetime.now(UTC),
            "createdById": manager_user.id,
        }
    )

    async with _client_as(manager_user) as client:
        response = await client.get("/api/v1/manager/books", params={"search": TEST_TITLE_MARKER})

    entry = next(item for item in response.json()["items"] if item["id"] == book_id)
    assert entry["available_copies"] == 1
    assert entry["is_available"] is True
    assert entry["expected_available_at"] is None


async def test_book_availability_search_matches_title_or_author(manager_user):
    unique_marker = uuid.uuid4().hex[:8]
    await _create_book(
        manager_user, title=f"{TEST_TITLE_MARKER}{unique_marker}", author="Unmatched Author"
    )

    async with _client_as(manager_user) as client:
        response = await client.get("/api/v1/manager/books", params={"search": unique_marker})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert unique_marker in body["items"][0]["title"]
