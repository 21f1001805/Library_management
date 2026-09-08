import { HttpError } from '@/server/http';
import * as booksRepository from '@/server/books/repository';
import * as repository from '@/server/wishlist/repository';

// Mirrors backend/src/app/modules/wishlist/service.py.
export async function listWishlist(memberId: string): Promise<string[]> {
  return repository.listBookIdsForMember(memberId);
}

export async function addToWishlist(memberId: string, bookId: string): Promise<void> {
  const book = await booksRepository.findById(bookId);
  if (!book) throw new HttpError(404, 'Book not found');
  await repository.add(memberId, bookId);
}

export async function removeFromWishlist(memberId: string, bookId: string): Promise<void> {
  // Idempotent — removing something already absent is a no-op, not an error, so a
  // retried/duplicate optimistic-UI request never surfaces a spurious failure.
  await repository.remove(memberId, bookId);
}
