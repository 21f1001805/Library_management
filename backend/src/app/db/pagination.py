from typing import Any, Protocol, TypeVar

T = TypeVar("T")


class _PaginatableModel(Protocol[T]):
    async def count(self, *, where: dict) -> int: ...
    async def find_many(self, **kwargs: Any) -> list[T]: ...


async def paginate(
    model: _PaginatableModel[T],
    *,
    where: dict,
    order: dict,
    skip: int,
    take: int,
    include: dict | None = None,
) -> tuple[list[T], int]:
    total = await model.count(where=where)
    items = await model.find_many(
        where=where,
        order=order,
        skip=skip,
        take=take,
        **({"include": include} if include else {}),
    )
    return items, total
