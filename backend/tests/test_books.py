import os
import uuid
from datetime import UTC, datetime, timedelta

os.environ["APP_ENV"] = "test"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.constants import Role
from app.core.security import hash_password
from app.db.prisma import prisma
from app.main import create_app
from app.modules.members import repository as member_repository

os.environ.setdefault("DATABASE_URL", get_settings().database_url)

TEST_EMAIL_DOMAIN = "@books-test.example.com"
TEST_TITLE_MARKER = "BOOKS-TEST-"


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


def _unique_title() -> str:
    return f"{TEST_TITLE_MARKER}{uuid.uuid4().hex}"


def _unique_isbn() -> str:
    # 13 digits, shape-valid per the service's ISBN check (not a real checksum).
    return f"979{uuid.uuid4().int % 10**10:010d}"


def _book_payload(**overrides) -> dict:
    payload = {"title": _unique_title(), "author": "Test Author", "category": "Fiction"}
    payload.update(overrides)
    return payload


async def _make_user(role_name: str):
    role = await member_repository.upsert_role(role_name)
    return await member_repository.create_member(
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
    await prisma.loan.delete_many(where={"book": {"title": {"startswith": TEST_TITLE_MARKER}}})
    await prisma.book.delete_many(where={"title": {"startswith": TEST_TITLE_MARKER}})
    await prisma.user.delete_many(where={"email": {"endswith": TEST_EMAIL_DOMAIN}})
    await prisma.disconnect()


@pytest_asyncio.fixture
async def admin_user():
    return await _make_user(Role.ADMIN)


@pytest_asyncio.fixture
async def librarian_user():
    return await _make_user(Role.LIBRARIAN)


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


async def test_list_books_is_public():
    async with _anon_client() as client:
        response = await client.get("/api/v1/books")

    assert response.status_code == 200
    body = response.json()
    assert "items" in body and "total" in body


async def test_get_book_not_found():
    async with _anon_client() as client:
        response = await client.get(f"/api/v1/books/{uuid.uuid4()}")

    assert response.status_code == 404


async def test_get_book_rejects_malformed_id():
    async with _anon_client() as client:
        response = await client.get("/api/v1/books/not-a-uuid")

    assert response.status_code == 422


async def test_create_book_requires_authentication():
    async with _anon_client() as client:
        response = await client.post("/api/v1/books", json=_book_payload())

    assert response.status_code == 401


async def test_create_book_forbidden_for_member_role(member_user):
    async with _client_as(member_user) as client:
        response = await client.post("/api/v1/books", json=_book_payload())

    assert response.status_code == 403


async def test_create_book_success_as_librarian(librarian_user):
    title = _unique_title()
    isbn = _unique_isbn()
    async with _client_as(librarian_user) as client:
        response = await client.post(
            "/api/v1/books",
            json=_book_payload(
                title=title,
                isbn=isbn,
                description="A test book",
                published_year=2020,
                language="English",
            ),
        )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == title
    assert body["isbn"] == isbn
    assert body["published_year"] == 2020
    assert body["author"] == "Test Author"
    assert body["category"] == "Fiction"
    assert body["available"] is False


async def test_create_book_duplicate_isbn_conflicts(librarian_user):
    isbn = _unique_isbn()
    async with _client_as(librarian_user) as client:
        first = await client.post("/api/v1/books", json=_book_payload(isbn=isbn))
        second = await client.post("/api/v1/books", json=_book_payload(isbn=isbn))

    assert first.status_code == 201
    assert second.status_code == 409


async def test_create_book_rejects_invalid_isbn(librarian_user):
    async with _client_as(librarian_user) as client:
        response = await client.post("/api/v1/books", json=_book_payload(isbn="not-an-isbn"))

    assert response.status_code == 422


async def test_create_book_rejects_future_published_year(librarian_user):
    async with _client_as(librarian_user) as client:
        response = await client.post("/api/v1/books", json=_book_payload(published_year=3000))

    assert response.status_code == 422


async def test_create_book_requires_author_and_category(librarian_user):
    async with _client_as(librarian_user) as client:
        response = await client.post("/api/v1/books", json={"title": _unique_title()})

    assert response.status_code == 422


async def test_create_book_available_when_copies_positive(librarian_user):
    async with _client_as(librarian_user) as client:
        response = await client.post("/api/v1/books", json=_book_payload(total_copies=3))

    assert response.status_code == 201
    body = response.json()
    assert body["total_copies"] == 3
    assert body["available"] is True


async def test_list_books_search_and_pagination(librarian_user):
    unique_marker = uuid.uuid4().hex[:8]
    async with _client_as(librarian_user) as client:
        for i in range(3):
            await client.post(
                "/api/v1/books",
                json=_book_payload(title=f"{TEST_TITLE_MARKER}Searchable-{unique_marker}-{i}"),
            )

        response = await client.get(
            "/api/v1/books", params={"search": unique_marker, "page": 1, "page_size": 2}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert all(unique_marker in item["title"] for item in body["items"])


async def test_list_books_filters_by_category(librarian_user):
    unique_marker = uuid.uuid4().hex[:8]
    title = f"{TEST_TITLE_MARKER}CategoryFilter-{unique_marker}"
    async with _client_as(librarian_user) as client:
        await client.post("/api/v1/books", json=_book_payload(title=title, category="Science"))

        response = await client.get(
            "/api/v1/books", params={"search": unique_marker, "category": "Science"}
        )
        miss = await client.get(
            "/api/v1/books", params={"search": unique_marker, "category": "History"}
        )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert miss.json()["total"] == 0


async def test_update_book_changes_fields(librarian_user):
    async with _client_as(librarian_user) as client:
        created = await client.post("/api/v1/books", json=_book_payload())
        book_id = created.json()["id"]

        updated_title = f"{TEST_TITLE_MARKER}Updated-{uuid.uuid4().hex[:8]}"
        response = await client.put(
            f"/api/v1/books/{book_id}",
            json={"title": updated_title, "published_year": 1999},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == updated_title
    assert body["published_year"] == 1999


async def test_update_book_can_clear_nullable_fields(librarian_user):
    async with _client_as(librarian_user) as client:
        created = await client.post(
            "/api/v1/books",
            json=_book_payload(description="Has a description"),
        )
        book_id = created.json()["id"]
        assert created.json()["description"] == "Has a description"

        response = await client.put(f"/api/v1/books/{book_id}", json={"description": None})

    assert response.status_code == 200
    assert response.json()["description"] is None


async def test_delete_book_forbidden_for_librarian(librarian_user):
    async with _client_as(librarian_user) as client:
        created = await client.post("/api/v1/books", json=_book_payload())
        book_id = created.json()["id"]

        response = await client.delete(f"/api/v1/books/{book_id}")

    assert response.status_code == 403


async def test_delete_book_success_as_admin(admin_user, librarian_user):
    async with _client_as(librarian_user) as client:
        created = await client.post("/api/v1/books", json=_book_payload())
        book_id = created.json()["id"]

    async with _client_as(admin_user) as client:
        delete_response = await client.delete(f"/api/v1/books/{book_id}")

    async with _anon_client() as client:
        get_response = await client.get(f"/api/v1/books/{book_id}")

    assert delete_response.status_code == 204
    assert get_response.status_code == 404


async def test_related_books_not_found():
    async with _anon_client() as client:
        response = await client.get(f"/api/v1/books/{uuid.uuid4()}/related")

    assert response.status_code == 404


async def test_related_books_ranks_by_co_borrowing(member_user):
    anchor = await prisma.book.create(data=_book_payload(category="Fiction"))
    co_borrowed = await prisma.book.create(data=_book_payload(category="Sci-Fi"))
    unrelated = await prisma.book.create(data=_book_payload(category="History"))

    other_member = await _make_user(Role.MEMBER)
    for reader in (member_user, other_member):
        await prisma.loan.create(
            data={
                "bookId": anchor.id,
                "memberId": reader.id,
                "dueDate": datetime.now(UTC) + timedelta(days=7),
                "createdById": reader.id,
            }
        )
        await prisma.loan.create(
            data={
                "bookId": co_borrowed.id,
                "memberId": reader.id,
                "dueDate": datetime.now(UTC) + timedelta(days=7),
                "createdById": reader.id,
            }
        )

    async with _anon_client() as client:
        response = await client.get(f"/api/v1/books/{anchor.id}/related")

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()]
    assert co_borrowed.id in ids
    assert unrelated.id not in ids or ids.index(co_borrowed.id) < ids.index(unrelated.id)


async def test_related_books_falls_back_to_category_without_loan_history():
    anchor = await prisma.book.create(data=_book_payload(category="Poetry"))
    same_category = await prisma.book.create(data=_book_payload(category="Poetry"))

    async with _anon_client() as client:
        response = await client.get(f"/api/v1/books/{anchor.id}/related")

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()]
    assert same_category.id in ids
