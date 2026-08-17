from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from prisma.models import User

from app.api.deps import require_role
from app.core.constants import Role
from app.modules.books import service
from app.modules.books.schemas import BookCreate, BookListResponse, BookOut, BookUpdate

router = APIRouter(prefix="/books", tags=["books"])

manage_books = require_role(Role.ADMIN, Role.LIBRARIAN, Role.MANAGER)
delete_books = require_role(Role.ADMIN)


@router.get("", response_model=BookListResponse)
async def list_books(
    search: Annotated[
        str | None, Query(description="Match against title, author, or description")
    ] = None,
    category: Annotated[str | None, Query(description="Exact category match")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BookListResponse:
    return await service.list_books(
        search=search, category=category, page=page, page_size=page_size
    )


@router.get("/{book_id}", response_model=BookOut)
async def get_book(book_id: UUID) -> BookOut:
    return await service.get_book(str(book_id))


@router.get("/{book_id}/related", response_model=list[BookOut])
async def get_related_books(book_id: UUID) -> list[BookOut]:
    return await service.get_related_books(str(book_id))


@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
async def create_book(
    payload: BookCreate,
    _: Annotated[User, Depends(manage_books)],
) -> BookOut:
    return await service.create_book(payload)


@router.put("/{book_id}", response_model=BookOut)
async def update_book(
    book_id: UUID,
    payload: BookUpdate,
    _: Annotated[User, Depends(manage_books)],
) -> BookOut:
    return await service.update_book(str(book_id), payload)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: UUID,
    _: Annotated[User, Depends(delete_books)],
) -> None:
    await service.delete_book(str(book_id))
