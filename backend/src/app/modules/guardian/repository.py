from prisma.models import GuardianLink, User

from app.db.prisma import prisma

CHILD_INCLUDE = {"role": True}


async def create_link(*, guardian_id: str, member_id: str) -> GuardianLink:
    return await prisma.guardianlink.create(
        data={"guardianId": guardian_id, "memberId": member_id}
    )


async def list_children(guardian_id: str) -> list[User]:
    links = await prisma.guardianlink.find_many(
        where={"guardianId": guardian_id}, include={"member": {"include": CHILD_INCLUDE}}
    )
    return [link.member for link in links]
