"""One-off import of assets/library_novels_400_updated.csv into the books table.

Run from backend/: `uv run python scripts/seed_books.py`
Safe to re-run — upserts on ISBN, so existing rows are updated in place rather than duplicated.
"""

import asyncio
import csv
import os
import random
import re
from pathlib import Path

import httpx

from app.core.config import get_settings
from app.db.prisma import prisma

CSV_PATH = Path(__file__).resolve().parents[2] / "assets" / "library_novels_400_updated.csv"

# The CSV has no copy-count column; assign a plausible spread so some books are
# checked out (0 copies) and most have a handful available, matching real usage.
_COPY_WEIGHTS = [0, 1, 2, 3, 4, 5, 6]
_COPY_CHANCES = [10, 25, 25, 20, 10, 6, 4]


def _clean_isbn(raw: str) -> str:
    return re.sub(r"[- ]", "", raw).upper()


def _total_copies(book_id: str) -> int:
    rng = random.Random(f"book-copies-{book_id}")
    return rng.choices(_COPY_WEIGHTS, weights=_COPY_CHANCES, k=1)[0]


def _isbn_cover_url(isbn: str) -> str:
    # Open Library serves covers straight off the ISBN, no lookup needed. `default=false`
    # makes it 404 (instead of returning a 1x1 placeholder gif) when it has no cover for
    # an ISBN, which BookCard's onError already handles by falling back to a placeholder icon.
    return f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false"


# The CSV's ISBNs are synthetic (not real registrations), so looking covers up by ISBN
# almost always misses. Searching Open Library by title+author instead — same API
# service.py's identify_cover flow already uses — finds the real edition's cover_i for
# these well-known novels far more reliably. Capped concurrency to stay polite to the
# (unauthenticated, free) API; falls back to the ISBN URL, which at worst 404s client-side.
_LOOKUP_CONCURRENCY = 8


async def _cover_by_search(client: httpx.AsyncClient, title: str, author: str) -> str | None:
    try:
        response = await client.get(
            "https://openlibrary.org/search.json",
            # The top relevance match is often a work/edition with no cover_i even when a
            # different edition of the same book has one, so scan a few candidates rather
            # than trusting doc[0].
            params={"title": title, "author": author, "limit": 5, "fields": "cover_i"},
        )
        response.raise_for_status()
        docs = response.json().get("docs") or []
        cover_i = next((doc["cover_i"] for doc in docs if doc.get("cover_i")), None)
        return f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg" if cover_i else None
    except (httpx.HTTPError, ValueError):
        return None


async def _resolve_cover_urls(rows: list[dict]) -> dict[str, str]:
    semaphore = asyncio.Semaphore(_LOOKUP_CONCURRENCY)

    async def resolve(client: httpx.AsyncClient, row: dict) -> tuple[str, str]:
        isbn = _clean_isbn(row["isbn"])
        async with semaphore:
            found = await _cover_by_search(client, row["title"].strip(), row["author"].strip())
        return isbn, found or _isbn_cover_url(isbn)

    async with httpx.AsyncClient(timeout=8.0) as client:
        results = await asyncio.gather(*(resolve(client, row) for row in rows))
    return dict(results)


def _row_to_book_data(row: dict, cover_image_url: str) -> dict:
    return {
        "title": row["title"].strip(),
        "author": row["author"].strip(),
        "category": "Fiction",
        "genre": row["genre"].strip() or None,
        "isbn": _clean_isbn(row["isbn"]),
        "description": row["summary"].strip(),
        "publishedYear": int(row["publication_year"]),
        "language": row["language"].strip(),
        "totalCopies": _total_copies(row["book_id"]),
        "coverImageUrl": cover_image_url,
    }


async def main() -> None:
    settings = get_settings()
    os.environ.setdefault("DATABASE_URL", settings.database_url)
    await prisma.connect()

    try:
        with CSV_PATH.open(encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        cover_urls = await _resolve_cover_urls(rows)

        created = 0
        updated = 0
        for row in rows:
            isbn = _clean_isbn(row["isbn"])
            data = _row_to_book_data(row, cover_urls[isbn])
            existing = await prisma.book.find_unique(where={"isbn": data["isbn"]})
            await prisma.book.upsert(
                where={"isbn": data["isbn"]},
                data={"create": data, "update": data},
            )
            if existing is None:
                created += 1
            else:
                updated += 1

        print(f"Seeded {len(rows)} books ({created} created, {updated} updated).")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
