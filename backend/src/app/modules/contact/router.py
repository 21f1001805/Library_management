from fastapi import APIRouter, status

from app.core.constants import Role
from app.db.prisma import prisma
from app.modules.contact.schemas import ContactMessageCreate
from app.modules.notifications import service as notifications_service

router = APIRouter(prefix="/contact", tags=["contact"])

_RECIPIENT_ROLES = {Role.ADMIN, Role.IT_HEAD}


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def submit_contact_message(payload: ContactMessageCreate) -> None:
    staff = await prisma.user.find_many(
        where={"role": {"name": {"in": list(_RECIPIENT_ROLES)}}, "deletedAt": None}
    )
    message = (
        f"{payload.name} ({payload.email}, {payload.phone_number}) at {payload.organization} "
        f"— {payload.subject}\n\n{payload.message}"
    )
    for member in staff:
        await notifications_service.create_notification(member.id, "contact-message", message)
