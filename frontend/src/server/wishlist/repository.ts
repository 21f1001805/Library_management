import { prisma } from '@/server/db';

// Mirrors backend/src/app/modules/wishlist/repository.py.
export async function listBookIdsForMember(memberId: string): Promise<string[]> {
  const rows = await prisma.wishlist.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => row.bookId);
}

export async function add(memberId: string, bookId: string): Promise<void> {
  await prisma.wishlist.upsert({
    where: { memberId_bookId: { memberId, bookId } },
    create: { memberId, bookId },
    update: {},
  });
}

export async function remove(memberId: string, bookId: string): Promise<void> {
  await prisma.wishlist.deleteMany({ where: { memberId, bookId } });
}
