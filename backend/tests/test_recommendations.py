"""Tests for the "Find My Next Book" quiz.

Two strategies, deliberately kept apart:

1. HTTP-level tests against the real dev database (401 real, already-seeded books) —
   auth, answer validation, and end-to-end contract smoke tests. These can't manufacture
   a specific catalog shape, so they only assert things true of *any* real catalog (e.g.
   "no category/language question is ever offered" — true today because the real data is
   flat on those fields, which is itself the finding driving this whole feature).

2. Direct unit tests on service.py/scoring.py, monkeypatching the repository functions
   (the I/O boundary) to simulate specific catalog shapes — used for anything that needs
   to force a particular scenario (small catalog, one relaxation level short of another,
   catalog changing between two calls). This avoids depending on, or mutating, the shared
   dev database's real book rows, mirroring how test_chat_context.py tests orchestration
   logic directly rather than needing a live LLM.
"""

import os
import uuid
from collections import Counter
from datetime import UTC, datetime

os.environ["APP_ENV"] = "test"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from prisma.models import Book

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.constants import Role
from app.core.security import hash_password
from app.db.prisma import prisma
from app.main import create_app
from app.modules.members import repository as member_repository
from app.modules.recommendations import repository, scoring, service
from app.modules.recommendations.schemas import NO_PREFERENCE, QuizAnswers

os.environ.setdefault("DATABASE_URL", get_settings().database_url)

TEST_EMAIL_DOMAIN = "@recs-test.example.com"


def _unique_email() -> str:
    return f"{uuid.uuid4().hex}{TEST_EMAIL_DOMAIN}"


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
    # Only ever deletes users this file created — never touches book rows.
    await prisma.user.delete_many(where={"email": {"endswith": TEST_EMAIL_DOMAIN}})
    await prisma.disconnect()


@pytest_asyncio.fixture
async def member_user():
    return await _make_user(Role.MEMBER)


@pytest_asyncio.fixture
async def librarian_user():
    return await _make_user(Role.LIBRARIAN)


def _client_as(user) -> AsyncClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _anon_client() -> AsyncClient:
    app = create_app()
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _book(**overrides) -> Book:
    defaults = dict(
        id=str(uuid.uuid4()),
        title="Untitled",
        author="Test Author",
        category="Fiction",
        isbn=None,
        description=None,
        publishedYear=None,
        language="English",
        coverImageUrl=None,
        totalCopies=1,
        createdAt=datetime.now(UTC),
        updatedAt=datetime.now(UTC),
        deletedAt=None,
    )
    defaults.update(overrides)
    return Book(**defaults)


# ═══════════════════════════════════════════════════════════════════════════
# HTTP-level: auth, validation, real-catalog contract
# ═══════════════════════════════════════════════════════════════════════════


async def test_quiz_requires_authentication():
    async with _anon_client() as client:
        response = await client.get("/api/v1/recommendations/quiz")
    assert response.status_code == 401


async def test_quiz_rejects_non_member_role(librarian_user):
    async with _client_as(librarian_user) as client:
        response = await client.get("/api/v1/recommendations/quiz")
    assert response.status_code == 403


async def test_quiz_reflects_real_catalog_shape(member_user):
    """The live dev catalog is 400/401 category=Fiction and 385/401 language=English —
    effectively single-valued on both. Asking about either would violate the whole
    premise of the feature, so neither question id should ever appear."""
    async with _client_as(member_user) as client:
        response = await client.get("/api/v1/recommendations/quiz")

    assert response.status_code == 200
    body = response.json()
    question_ids = {q["id"] for q in body["questions"]}
    assert "category" not in question_ids
    assert "language" not in question_ids
    for question in body["questions"]:
        assert len(question["options"]) >= 2
        assert question["options"][-1]["id"] == NO_PREFERENCE


async def test_submit_quiz_returns_real_books(member_user):
    async with _client_as(member_user) as client:
        response = await client.post("/api/v1/recommendations/quiz", json={})

    assert response.status_code == 200
    body = response.json()
    assert 0 <= len(body["items"]) <= service.MAX_RESULTS
    assert isinstance(body["message"], str) and body["message"]

    if body["items"]:
        ids = [item["book"]["id"] for item in body["items"]]
        real_books = await prisma.book.find_many(where={"id": {"in": ids}})
        assert {b.id for b in real_books} == set(ids)
        for item in body["items"]:
            assert item["reasons"]


async def test_submit_quiz_ignores_fabricated_answer_values(member_user):
    """A client-supplied author/era that doesn't correspond to any real catalog value
    must not crash the request or be silently honored as a real filter."""
    async with _client_as(member_user) as client:
        response = await client.post(
            "/api/v1/recommendations/quiz",
            json={"author": "Not A Real Author XYZ", "era": "not_a_real_era"},
        )

    assert response.status_code == 200


async def test_submit_quiz_excludes_already_borrowed_books(member_user, librarian_user):
    from datetime import timedelta

    book = await prisma.book.create(
        data={
            "title": f"RECS-TEST-{uuid.uuid4().hex}",
            "author": "Test Author",
            "category": "Fiction",
            "totalCopies": 1,
        }
    )
    await prisma.loan.create(
        data={
            "bookId": book.id,
            "memberId": member_user.id,
            "createdById": librarian_user.id,
            "dueDate": datetime.now(UTC) + timedelta(days=14),
        }
    )
    try:
        borrowed_ids, _ = await service._member_loan_context(member_user.id)
        assert book.id in borrowed_ids

        async with _client_as(member_user) as client:
            response = await client.post("/api/v1/recommendations/quiz", json={})
        assert response.status_code == 200
        ids = [item["book"]["id"] for item in response.json()["items"]]
        assert book.id not in ids
    finally:
        await prisma.loan.delete_many(where={"bookId": book.id})
        await prisma.book.delete(where={"id": book.id})


# ═══════════════════════════════════════════════════════════════════════════
# scoring.py — pure functions, no DB
# ═══════════════════════════════════════════════════════════════════════════


def test_matching_book_outscores_non_matching_book():
    matching = _book(author="Ruskin Bond", publishedYear=1960, totalCopies=1)
    non_matching = _book(author="Someone Else", publishedYear=2015, totalCopies=1)
    answers = QuizAnswers(author="Ruskin Bond", era="1950_1989")

    scored = scoring.score_candidates(
        [non_matching, matching],
        answers,
        ratings={},
        loan_counts={},
        history_authors=Counter(),
    )

    assert scored[0].book.id == matching.id
    assert scored[0].score > scored[1].score
    assert scored[0].reasons


def test_story_type_scores_by_description_keywords():
    on_theme = _book(description="A gripping murder mystery full of suspense.")
    off_theme = _book(description="A heartwarming tale about family and friendship.")
    answers = QuizAnswers(story_type="mystery_thriller")

    scored = scoring.score_candidates(
        [off_theme, on_theme], answers, ratings={}, loan_counts={}, history_authors=Counter()
    )

    assert scored[0].book.id == on_theme.id


def test_availability_is_a_bonus_not_a_dominant_tier():
    """A highly relevant book that's currently unavailable should still be able to
    outrank a barely relevant one that happens to be available — availability nudges
    the ranking, it doesn't override relevance outright."""
    highly_relevant_unavailable = _book(author="Ruskin Bond", publishedYear=1960, totalCopies=0)
    barely_relevant_available = _book(author="Nobody", publishedYear=2015, totalCopies=1)
    answers = QuizAnswers(author="Ruskin Bond", era="1950_1989")

    scored = scoring.score_candidates(
        [barely_relevant_available, highly_relevant_unavailable],
        answers,
        ratings={},
        loan_counts={},
        history_authors=Counter(),
    )

    assert scored[0].book.id == highly_relevant_unavailable.id


def test_availability_still_breaks_a_near_tie():
    equally_relevant_unavailable = _book(author="Ruskin Bond", totalCopies=0)
    equally_relevant_available = _book(author="Ruskin Bond", totalCopies=1)
    answers = QuizAnswers(author="Ruskin Bond")

    scored = scoring.score_candidates(
        [equally_relevant_unavailable, equally_relevant_available],
        answers,
        ratings={},
        loan_counts={},
        history_authors=Counter(),
    )

    assert scored[0].book.id == equally_relevant_available.id


def test_high_rating_gives_an_ambient_boost_with_no_question_asked():
    highly_rated = _book(author="A")
    unrated = _book(author="A")
    answers = QuizAnswers()  # no rating preference exists to answer anymore

    scored = scoring.score_candidates(
        [unrated, highly_rated],
        answers,
        ratings={highly_rated.id: (4.5, 10)},  # unrated omitted, matching real usage
        loan_counts={},
        history_authors=Counter(),
    )

    assert scored[0].book.id == highly_rated.id
    assert "Highly rated" in scored[0].reasons[0]


def test_history_bonus_favors_previously_enjoyed_authors():
    familiar = _book(author="Agatha Christie")
    unfamiliar = _book(author="Nobody")
    answers = QuizAnswers()

    scored = scoring.score_candidates(
        [unfamiliar, familiar],
        answers,
        ratings={},
        loan_counts={},
        history_authors=Counter({"Agatha Christie": 3}),
    )

    assert scored[0].book.id == familiar.id


# ═══════════════════════════════════════════════════════════════════════════
# service.py — quiz generation adapts to the catalog (monkeypatched, no live DB)
# ═══════════════════════════════════════════════════════════════════════════


async def test_author_question_skipped_when_no_author_qualifies(monkeypatch):
    monkeypatch.setattr(repository, "count_books_by_author", _async_return([]))
    era_counts = {"2010_plus": 50, "pre_1950": 40}
    monkeypatch.setattr(repository, "count_books_by_era", _async_return(era_counts))
    monkeypatch.setattr(repository, "count_described_books", _async_return(0))
    monkeypatch.setattr(repository, "count_loaned_books", _async_return((0, 0)))

    quiz = await service.build_quiz()

    assert "author" not in {q.id for q in quiz.questions}
    assert "era" in {q.id for q in quiz.questions}


async def test_era_question_skipped_when_catalog_is_one_era(monkeypatch):
    monkeypatch.setattr(repository, "count_books_by_author", _async_return([("Someone", 10)]))
    monkeypatch.setattr(repository, "count_books_by_era", _async_return({"2010_plus": 100}))
    monkeypatch.setattr(repository, "count_described_books", _async_return(0))
    monkeypatch.setattr(repository, "count_loaned_books", _async_return((0, 0)))

    quiz = await service.build_quiz()

    assert "era" not in {q.id for q in quiz.questions}


async def test_quiz_adapts_when_catalog_changes(monkeypatch):
    def _patch(authors):
        monkeypatch.setattr(repository, "count_books_by_author", _async_return(authors))
        monkeypatch.setattr(repository, "count_books_by_era", _async_return({}))
        monkeypatch.setattr(repository, "count_described_books", _async_return(0))
        monkeypatch.setattr(repository, "count_loaned_books", _async_return((0, 0)))

    _patch([])
    empty_catalog_quiz = await service.build_quiz()
    _patch([("Ruskin Bond", 18), ("R.K. Narayan", 12)])
    populated_catalog_quiz = await service.build_quiz()

    assert empty_catalog_quiz.questions == []
    assert any(q.id == "author" for q in populated_catalog_quiz.questions)


async def test_empty_catalog_returns_honest_empty_state(monkeypatch):
    monkeypatch.setattr(repository, "find_candidates", _async_return([]))
    monkeypatch.setattr(service, "_valid_authors", _async_return([]))
    monkeypatch.setattr(service, "_valid_eras", _async_return([]))

    result = await service.submit_quiz(str(uuid.uuid4()), QuizAnswers())

    assert result.items == []
    assert "aren't enough books" in result.message


def _async_return(value):
    async def _inner(*args, **kwargs):
        return value

    return _inner


# ═══════════════════════════════════════════════════════════════════════════
# service.py — progressive relaxation ladder (monkeypatched repository calls)
# ═══════════════════════════════════════════════════════════════════════════


async def test_relaxation_stays_strict_when_enough_matches(monkeypatch):
    strict_books = [_book() for _ in range(service.MIN_RESULTS)]

    async def find_candidates(*, author=None, era=None, exclude_ids=None):
        assert author == "X" and era == "1950_1989"
        return strict_books

    monkeypatch.setattr(repository, "find_candidates", find_candidates)

    candidates, relaxed = await service._fetch_candidates(
        QuizAnswers(author="X", era="1950_1989"), exclude_ids=set()
    )

    assert candidates == strict_books
    assert relaxed is False


async def test_relaxation_drops_era_before_author(monkeypatch):
    author_only_books = [_book() for _ in range(service.MIN_RESULTS)]
    calls: list[dict] = []

    async def find_candidates(*, author=None, era=None, exclude_ids=None):
        calls.append({"author": author, "era": era})
        if era is not None:
            return []  # strict level: not enough
        return author_only_books

    monkeypatch.setattr(repository, "find_candidates", find_candidates)

    candidates, relaxed = await service._fetch_candidates(
        QuizAnswers(author="X", era="1950_1989"), exclude_ids=set()
    )

    assert candidates == author_only_books
    assert relaxed is True
    assert calls == [{"author": "X", "era": "1950_1989"}, {"author": "X", "era": None}]


async def test_relaxation_falls_back_to_whole_catalog(monkeypatch):
    whole_catalog = [_book()]  # fewer than MIN_RESULTS — still the honest final answer

    async def find_candidates(*, author=None, era=None, exclude_ids=None):
        if author is not None or era is not None:
            return []
        return whole_catalog

    monkeypatch.setattr(repository, "find_candidates", find_candidates)

    candidates, relaxed = await service._fetch_candidates(
        QuizAnswers(author="X", era="1950_1989"), exclude_ids=set()
    )

    assert candidates == whole_catalog
    assert relaxed is True


async def test_relaxation_tries_era_alone_when_author_not_given(monkeypatch):
    calls: list[dict] = []

    async def find_candidates(*, author=None, era=None, exclude_ids=None):
        calls.append({"author": author, "era": era})
        return [_book() for _ in range(service.MIN_RESULTS)] if era else []

    monkeypatch.setattr(repository, "find_candidates", find_candidates)

    await service._fetch_candidates(QuizAnswers(era="2010_plus"), exclude_ids=set())

    assert calls == [{"author": None, "era": "2010_plus"}]


# ═══════════════════════════════════════════════════════════════════════════
# service.py — answer normalization never trusts the client
# ═══════════════════════════════════════════════════════════════════════════


async def test_normalize_answers_drops_unrecognized_values(monkeypatch):
    monkeypatch.setattr(service, "_valid_authors", _async_return(["Ruskin Bond"]))
    monkeypatch.setattr(service, "_valid_eras", _async_return(["2010_plus"]))

    cleaned = await service._normalize_answers(
        QuizAnswers(author="Someone Fabricated", era="2010_plus", story_type="not_a_real_type")
    )

    assert cleaned.author is None  # not in the live-valid set -> dropped
    assert cleaned.era == "2010_plus"  # in the live-valid set -> kept
    assert cleaned.story_type is None  # not a real story-type key -> dropped


async def test_normalize_answers_treats_no_preference_as_none(monkeypatch):
    monkeypatch.setattr(service, "_valid_authors", _async_return(["Ruskin Bond"]))
    monkeypatch.setattr(service, "_valid_eras", _async_return([]))

    cleaned = await service._normalize_answers(QuizAnswers(author=NO_PREFERENCE))

    assert cleaned.author is None
