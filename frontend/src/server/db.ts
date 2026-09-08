import { PrismaClient } from '@prisma/client';

// Reused across hot-reloads in dev so `next dev` doesn't open a fresh pool of DB
// connections on every edit — mirrors backend/src/app/db/prisma.py's module-level
// singleton, just with the dev-reload wrinkle Next.js's per-request module reload needs.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
