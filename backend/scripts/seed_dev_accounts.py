"""Seeds one real, loggable-in account per role for the Login page's dev-only
"Continue as <role>" preview buttons (see Login.tsx). Those buttons used to fake
local auth state with no real token, so every backend-backed feature (Community,
Reservations, ...) silently showed empty data under a previewed role. This gives
each role a real account so preview mode gets a real, working session instead.

Run from backend/: `uv run python scripts/seed_dev_accounts.py`
Safe to re-run — upserts by email, so it just resets the password each time.
"""

import asyncio
import os

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.prisma import prisma

DEV_PASSWORD = "DevPreview123!"
DEV_EMAIL_DOMAIN = "devpreview.internal"

ROLES = ["admin", "member", "manager", "it-head", "guardian"]


def _email(role: str) -> str:
    return f"{role}@{DEV_EMAIL_DOMAIN}"


async def main() -> None:
    settings = get_settings()
    os.environ.setdefault("DATABASE_URL", settings.database_url)
    await prisma.connect()

    try:
        password_hash = hash_password(DEV_PASSWORD)
        for role_name in ROLES:
            role = await prisma.role.upsert(
                where={"name": role_name},
                data={"create": {"name": role_name}, "update": {}},
            )
            email = _email(role_name)
            await prisma.user.upsert(
                where={"email": email},
                data={
                    "create": {
                        "email": email,
                        "passwordHash": password_hash,
                        "fullName": f"Dev {role_name.title()} Preview",
                        "roleId": role.id,
                    },
                    "update": {"passwordHash": password_hash, "roleId": role.id},
                },
            )
            print(f"Seeded {email} ({role_name})")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
