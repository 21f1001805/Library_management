"""
Startup seeder — runs once per process boot, safe to re-run (all upserts).
Only seeds static reference data that the app cannot function without.
"""

from app.db.prisma import prisma

_ROLES = ["admin", "librarian", "manager", "member", "guardian", "it-head"]


async def run() -> None:
    for name in _ROLES:
        await prisma.role.upsert(
            where={"name": name},
            data={"create": {"name": name}, "update": {}},
        )
