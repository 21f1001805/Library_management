from fastapi import HTTPException, status

from app.modules.events import repository
from app.modules.events.schemas import (
    AttendanceSummary,
    EventCreate,
    EventListResponse,
    EventOut,
    EventUpdate,
)


async def list_events(*, page: int, page_size: int, member_id: str | None) -> EventListResponse:
    items, total = await repository.list_events(skip=(page - 1) * page_size, take=page_size)
    return EventListResponse(
        items=[EventOut.from_prisma(e, member_id=member_id) for e in items],
        total=total,
    )


async def get_event(event_id: str, *, member_id: str | None) -> EventOut:
    event = await repository.find_by_id(event_id)
    if event is None or event.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return EventOut.from_prisma(event, member_id=member_id)


async def create_event(payload: EventCreate, *, creator_id: str) -> EventOut:
    event = await repository.create_event(
        {
            "title": payload.title,
            "description": payload.description,
            "location": payload.location,
            "date": payload.date,
            "capacity": payload.capacity,
            "createdBy": creator_id,
        }
    )

    if payload.manager_ids:
        manager_ids = await repository.list_manager_ids(payload.manager_ids)
        await repository.set_manager_assignments(event.id, manager_ids)
        event = await repository.find_by_id(event.id)

    return EventOut.from_prisma(event, member_id=creator_id)


async def update_event(event_id: str, payload: EventUpdate) -> EventOut:
    event = await repository.find_by_id(event_id)
    if event is None or event.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    data: dict = {}
    if payload.title is not None:
        data["title"] = payload.title
    if "description" in payload.model_fields_set:
        data["description"] = payload.description
    if payload.location is not None:
        data["location"] = payload.location
    if payload.date is not None:
        data["date"] = payload.date
    if payload.capacity is not None:
        data["capacity"] = payload.capacity

    updated = await repository.update_event(event_id, data) if data else event

    if payload.manager_ids is not None:
        manager_ids = await repository.list_manager_ids(payload.manager_ids)
        await repository.set_manager_assignments(event_id, manager_ids)
        updated = await repository.find_by_id(event_id)

    return EventOut.from_prisma(updated)


async def delete_event(event_id: str) -> None:
    event = await repository.find_by_id(event_id)
    if event is None or event.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    await repository.soft_delete_event(event_id)


async def register(event_id: str, member_id: str) -> EventOut:
    event = await repository.find_by_id(event_id)
    if event is None or event.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    registrations = event.registrations or []
    if len(registrations) >= event.capacity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Event is at capacity")

    existing = await repository.find_registration(event_id, member_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already registered")

    await repository.create_registration(event_id, member_id)
    updated = await repository.find_by_id(event_id)
    return EventOut.from_prisma(updated, member_id=member_id)


async def unregister(event_id: str, member_id: str, *, viewer_id: str | None = None) -> EventOut:
    event = await repository.find_by_id(event_id)
    if event is None or event.deletedAt is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    existing = await repository.find_registration(event_id, member_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not registered")

    await repository.delete_registration(event_id, member_id)
    updated = await repository.find_by_id(event_id)
    # viewer_id lets staff remove someone else's registration without the response's
    # `registered` flag flipping to reflect the removed member instead of themselves.
    return EventOut.from_prisma(updated, member_id=viewer_id or member_id)


async def get_attendance_summary() -> AttendanceSummary:
    events_this_month = await repository.count_events_this_month()
    total_registrations = await repository.count_total_registrations()
    total_events, _ = await repository.list_events(skip=0, take=1000)
    total_capacity = sum(e.capacity for e in total_events)
    avg_rate = total_registrations / total_capacity if total_capacity > 0 else 0.0
    return AttendanceSummary(
        total_events_this_month=events_this_month,
        total_attendees=total_registrations,
        average_attendance_rate=round(avg_rate, 2),
    )
