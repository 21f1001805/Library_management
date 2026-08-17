import { useLocalStorageState } from '@/lib/useLocalStorageState';

// Persisted (not just in-memory) so the wishlist survives navigating away from
// the books pages, unlike the rest of the app's local-only demo state.
export function useWishlist() {
  const [wishlistIds, setWishlistIds] = useLocalStorageState<string[]>('wishlist', []);

  function isWishlisted(bookId: string): boolean {
    return wishlistIds.includes(bookId);
  }

  function toggleWishlist(bookId: string) {
    setWishlistIds(
      wishlistIds.includes(bookId)
        ? wishlistIds.filter((id) => id !== bookId)
        : [...wishlistIds, bookId],
    );
  }

  return { wishlistIds, isWishlisted, toggleWishlist };
}
