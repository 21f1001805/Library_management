from datetime import UTC, datetime

from prisma.models import SupportTicket

from app.db.prisma import prisma

INCLUDE = {
    "raisedBy": {"include": {"role": True}},
    "resolvedBy": {"include": {"role": True}},
}


async def create(*, raised_by_id: str, category: str, description: str) -> SupportTicket:
    return await prisma.supportticket.create(
        data={"raisedById": raised_by_id, "category": category, "description": description},
        include=INCLUDE,
    )


async def find_by_id(ticket_id: str) -> SupportTicket | None:
    return await prisma.supportticket.find_unique(where={"id": ticket_id}, include=INCLUDE)


async def list_for_raiser(raised_by_id: str) -> list[SupportTicket]:
    return await prisma.supportticket.find_many(
        where={"raisedById": raised_by_id}, include=INCLUDE, order={"createdAt": "desc"}
    )


async def list_all(*, status: str | None) -> list[SupportTicket]:
    where: dict = {}
    if status is not None:
        where["status"] = status
    return await prisma.supportticket.find_many(
        where=where, include=INCLUDE, order={"createdAt": "desc"}
    )


async def resolve(ticket_id: str, *, resolved_by_id: str, resolution_note: str) -> SupportTicket:
    return await prisma.supportticket.update(
        where={"id": ticket_id},
        data={
            "status": "resolved",
            "resolutionNote": resolution_note,
            "resolvedById": resolved_by_id,
            "resolvedAt": datetime.now(UTC),
        },
        include=INCLUDE,
    )


async def reopen(ticket_id: str) -> SupportTicket:
    return await prisma.supportticket.update(
        where={"id": ticket_id}, data={"status": "open"}, include=INCLUDE
    )


async def close(ticket_id: str) -> SupportTicket:
    return await prisma.supportticket.update(
        where={"id": ticket_id},
        data={"status": "closed", "closedAt": datetime.now(UTC)},
        include=INCLUDE,
    )
