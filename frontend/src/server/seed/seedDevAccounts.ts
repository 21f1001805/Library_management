import { prisma } from '@/server/db';
import { env } from '@/server/env';
import { Role } from '@/server/constants';
import { hashPassword } from '@/server/auth/security';

// Mirrors backend/scripts/seed_dev_accounts.py. Seeds one real, loggable-in account per
// role for the Login page's dev-only "Continue as <role>" preview buttons — each role
// gets a real account so preview mode gets a real, working session instead of faked
// local auth state. Safe to re-run: upserts by email, resetting mutable auth guards
// every time so a stale prior run's state (deactivation, bumped token version) never
// lingers across re-seeds.

// The E2E suite logs in with this exact value, so it stays the default rather than
// becoming a required variable.
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD ?? 'DevPreview123!';
const DEV_EMAIL_DOMAIN = 'devpreview.internal';
const SEEDABLE_ENVIRONMENTS = new Set(['development', 'test', 'e2e']);

const ROLES = Object.values(Role);

function email(role: string): string {
  return `${role}@${DEV_EMAIL_DOMAIN}`;
}

const DEV_AVATARS: Record<string, string> = {
  admin: 'admin_1.jpg',
  manager: 'staff_1.jpg',
  member: 'member_female9.jpg',
  guardian: 'member_male_7.jpg',
  'it-head': 'it-head_1.jpg',
  librarian: 'staff_2.jpg',
};

// Matches Python's str.title() on a hyphenated role name: "it-head" -> "It-Head" (every
// segment split on non-letters gets capitalised), not "It-head".
function titleCase(value: string): string {
  return value.replace(/[a-z]+/gi, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

export async function seedDevAccounts(): Promise<string> {
  if (!SEEDABLE_ENVIRONMENTS.has(env.APP_ENV)) {
    throw new Error(
      `refusing to seed known-password accounts with APP_ENV=${JSON.stringify(env.APP_ENV)} — ` +
        `allowed only in ${[...SEEDABLE_ENVIRONMENTS].sort().join(', ')}`,
    );
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);
  let lastLine = '';
  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName },
      update: {},
    });
    const addr = email(roleName);
    const avatarUrl = DEV_AVATARS[roleName] ?? null;
    await prisma.user.upsert({
      where: { email: addr },
      create: {
        email: addr,
        passwordHash,
        fullName: `Dev ${titleCase(roleName)} Preview`,
        avatarUrl,
        roleId: role.id,
      },
      // E2E exercises account deactivation and token invalidation. Reset every mutable
      // authentication guard so rerunning the seed always produces the same usable
      // preview accounts instead of inheriting state from a prior run.
      update: {
        passwordHash,
        avatarUrl,
        roleId: role.id,
        isActive: true,
        deletedAt: null,
        tokenVersion: 0,
      },
    });
    lastLine = `Seeded ${addr} (${roleName})`;
    console.log(lastLine);
  }
  return lastLine;
}
