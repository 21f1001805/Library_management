from collections import Counter, defaultdict

from prisma.models import Book

from app.modules.books import repository as books_repository
from app.modules.books.schemas import BookOut
from app.modules.recommendations import repository, scoring
from app.modules.recommendations.schemas import (
    NO_PREFERENCE,
    QuizAnswers,
    QuizOption,
    QuizQuestion,
    QuizResponse,
    RecommendationItem,
    RecommendationResponse,
)

# Thresholds for whether a dimension is worth asking about at all. Deliberately low —
# these gate "does this attribute meaningfully differentiate the catalog", not "is this a
# statistically robust sample". A 401-book catalog trivially clears all of them for
# author/era; they mostly matter for tests exercising a small/skewed seeded catalog.
MIN_BOOKS_PER_AUTHOR_OPTION = 5
MAX_AUTHOR_OPTIONS = 6
MIN_ERA_BUCKET_BOOKS = 5
MIN_QUALIFYING_ERA_BUCKETS = 2
MIN_DESCRIBED_BOOKS_FOR_STORY_TYPE = 10
MIN_GROUP_SIZE_FOR_POPULARITY = 5

MIN_RESULTS = 5
MAX_RESULTS = 6

ERA_LABELS: dict[str, str] = {
    "pre_1950": "Timeless classics (before 1950)",
    "1950_1989": "Retro favorites (1950s-80s)",
    "1990_2009": "Modern era (1990s-2000s)",
    "2010_plus": "Fresh releases (2010 onward)",
}
POPULARITY_OPTIONS = {
    "trending": "What's trending with other members",
    "hidden_gems": "Hidden gems",
}

_SURPRISE_ME = QuizOption(id=NO_PREFERENCE, label="Surprise me")


async def _valid_authors() -> list[str]:
    rows = await repository.count_books_by_author(MIN_BOOKS_PER_AUTHOR_OPTION, MAX_AUTHOR_OPTIONS)
    return [name for name, _ in rows]


async def _valid_eras() -> list[str]:
    counts = await repository.count_books_by_era()
    return [key for key in ERA_LABELS if counts.get(key, 0) >= MIN_ERA_BUCKET_BOOKS]


async def build_quiz() -> QuizResponse:
    """Every question and option is computed live from the current catalog, so the quiz
    adapts automatically as books are added, removed, borrowed, or reviewed. A field with
    no meaningful diversity (this catalog's `category`/`language` are effectively single-
    valued) simply never produces a question — see the module docstring-equivalent
    thresholds above.
    """
    questions: list[QuizQuestion] = []

    authors = await _valid_authors()
    if authors:
        questions.append(
            QuizQuestion(
                id="author",
                prompt="Any author whose books you'd like more of?",
                options=[QuizOption(id=name, label=name) for name in authors] + [_SURPRISE_ME],
            )
        )

    eras = await _valid_eras()
    if len(eras) >= MIN_QUALIFYING_ERA_BUCKETS:
        questions.append(
            QuizQuestion(
                id="era",
                prompt="How old-school do you like your reads?",
                options=[QuizOption(id=key, label=ERA_LABELS[key]) for key in eras]
                + [_SURPRISE_ME],
            )
        )

    described = await repository.count_described_books()
    if described >= MIN_DESCRIBED_BOOKS_FOR_STORY_TYPE:
        questions.append(
            QuizQuestion(
                id="story_type",
                prompt="What kind of story pulls you in right now?",
                options=[QuizOption(id=key, label=label) for key, label, _ in scoring.STORY_TYPES]
                + [_SURPRISE_ME],
            )
        )

    borrowed, never_borrowed = await repository.count_loaned_books()
    has_borrowed_group = borrowed >= MIN_GROUP_SIZE_FOR_POPULARITY
    has_unborrowed_group = never_borrowed >= MIN_GROUP_SIZE_FOR_POPULARITY
    if has_borrowed_group and has_unborrowed_group:
        popularity_options = [
            QuizOption(id=key, label=label) for key, label in POPULARITY_OPTIONS.items()
        ]
        questions.append(
            QuizQuestion(
                id="popularity",
                prompt="Do you want proven favorites or something undiscovered?",
                options=popularity_options + [_SURPRISE_ME],
            )
        )

    return QuizResponse(questions=questions)


async def _normalize_answers(raw: QuizAnswers) -> QuizAnswers:
    """Re-validates every answer against a freshly recomputed valid-value set. A value
    that isn't currently valid (stale, tampered, or simply never real) is treated as "no
    preference" rather than trusted or erroring the whole request — the backend decides
    what's real, never the client.
    """
    valid_authors = set(await _valid_authors())
    valid_eras = set(await _valid_eras())

    def clean(value: str | None, valid: set[str] | None = None) -> str | None:
        if not value or value == NO_PREFERENCE:
            return None
        if valid is not None and value not in valid:
            return None
        return value

    return QuizAnswers(
        author=clean(raw.author, valid_authors),
        era=clean(raw.era, valid_eras),
        story_type=clean(raw.story_type, set(scoring.STORY_TYPE_KEYWORDS)),
        popularity=clean(raw.popularity, set(POPULARITY_OPTIONS)),
    )


async def _fetch_candidates(
    answers: QuizAnswers, *, exclude_ids: set[str]
) -> tuple[list[Book], bool]:
    """Tries the strictest filter combination the member actually specified, then
    progressively drops the weaker of the two hard-filterable fields (era before author —
    an author pick is a more specific signal than a 20-40 year window) down to the whole
    catalog. Returns (candidates, relaxed) where `relaxed` is True iff we had to go
    looser than the member's own strictest stated preference to find enough matches.
    Already-borrowed books never appear — recommending something the member has already
    read isn't a matter of taste, it's a miss, at every relaxation stage alike.
    """
    levels: list[dict[str, str]] = []
    if answers.author and answers.era:
        levels.append({"author": answers.author, "era": answers.era})
    if answers.author:
        levels.append({"author": answers.author})
    elif answers.era:
        levels.append({"era": answers.era})
    levels.append({})

    for index, kwargs in enumerate(levels):
        candidates = await repository.find_candidates(**kwargs, exclude_ids=exclude_ids)
        if len(candidates) >= MIN_RESULTS or index == len(levels) - 1:
            return candidates, index > 0
    return [], True  # unreachable — `levels` always ends in {}


def _ratings_by_book(reviews: list) -> dict[str, tuple[float, int]]:
    grouped: dict[str, list[int]] = defaultdict(list)
    for review in reviews:
        grouped[review.bookId].append(review.rating)
    return {
        book_id: (round(sum(values) / len(values), 1), len(values))
        for book_id, values in grouped.items()
    }


async def _member_loan_context(member_id: str) -> tuple[set[str], Counter[str]]:
    """One query serving two purposes: which books to exclude (already borrowed) and
    which authors to bonus-score (borrowed more than once)."""
    loans = await books_repository.list_loans_for_member(member_id)
    borrowed_ids = {loan.bookId for loan in loans}
    author_counts = Counter(loan.book.author for loan in loans)
    return borrowed_ids, author_counts


async def submit_quiz(member_id: str, raw_answers: QuizAnswers) -> RecommendationResponse:
    answers = await _normalize_answers(raw_answers)
    borrowed_ids, history_authors = await _member_loan_context(member_id)
    candidates, relaxed = await _fetch_candidates(answers, exclude_ids=borrowed_ids)

    if not candidates:
        return RecommendationResponse(
            items=[],
            relaxed=True,
            message="There aren't enough books in the library to create recommendations yet.",
        )

    book_ids = [book.id for book in candidates]
    reviews = await repository.list_reviews_for_books(book_ids)
    ratings = _ratings_by_book(reviews)
    loan_counts = await repository.count_loans_for_books(book_ids)

    scored = scoring.score_candidates(
        candidates,
        answers,
        ratings=ratings,
        loan_counts=loan_counts,
        history_authors=history_authors,
    )

    # Defensive: the query shape here can't currently produce duplicate rows, but a
    # result list is a promise worth keeping cheaply even if that changes later.
    seen: set[str] = set()
    top = []
    for candidate in scored:
        if candidate.book.id in seen:
            continue
        seen.add(candidate.book.id)
        top.append(candidate)
        if len(top) == MAX_RESULTS:
            break

    def _book_out(book: Book) -> BookOut:
        average_rating, review_count = ratings.get(book.id, (None, 0))
        return BookOut.from_prisma(book, average_rating=average_rating, review_count=review_count)

    items = [
        RecommendationItem(
            book=_book_out(sb.book),
            score=sb.score,
            reasons=sb.reasons or ["From our library catalog"],
        )
        for sb in top
    ]

    if len(top) < MIN_RESULTS:
        message = "We found the closest matches from the books currently available in our library."
    elif relaxed:
        message = "We expanded your search to find more great matches from our library."
    else:
        message = "Here's what we found based on your preferences."

    return RecommendationResponse(items=items, relaxed=relaxed, message=message)
