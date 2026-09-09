import { createHash } from 'node:crypto';

// A small deterministic PRNG (mulberry32) wrapped with Python `random.Random`-shaped
// helper methods, for porting backend/scripts/seed_*.py's seeded demo-data generation.
//
// NOT bit-for-bit identical to CPython's Mersenne Twister — there is no faithful JS port
// of that algorithm's `sample`/`choices`/`shuffle` internals — so a given seed produces
// different concrete random values here than the Python original did. What's preserved
// is the *shape*: the same distributions, weights, and call order, so the generated demo
// data is equally plausible and internally consistent, just not byte-identical. This is a
// deliberate, accepted divergence (see the migration plan), not a bug to chase.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derives a 32-bit numeric seed from an arbitrary string (FNV-1a) — mirrors the shape of
// Python's `random.Random(some_string)` (e.g. seed_books.py's per-book
// `random.Random(f"book-copies-{book_id}")`), which lets the same book id always seed the
// same copy-count draw without a PRNG shared across unrelated books.
export function seedFromString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private next: () => number;

  constructor(seed: number | string) {
    this.next = mulberry32(typeof seed === 'string' ? seedFromString(seed) : seed);
  }

  // [0, 1) — mirrors random.random().
  random(): number {
    return this.next();
  }

  // Inclusive of both ends — mirrors random.randint(a, b).
  randint(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  choice<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('choice() called on an empty sequence');
    return items[Math.floor(this.next() * items.length)];
  }

  // With replacement, k draws — mirrors random.choices(population, weights=..., k=...).
  choices<T>(items: readonly T[], weights: readonly number[], k = 1): T[] {
    const total = weights.reduce((sum, w) => sum + w, 0);
    const result: T[] = [];
    for (let n = 0; n < k; n++) {
      let target = this.next() * total;
      let picked = items[items.length - 1];
      for (let i = 0; i < items.length; i++) {
        target -= weights[i];
        if (target <= 0) {
          picked = items[i];
          break;
        }
      }
      result.push(picked);
    }
    return result;
  }

  // Without replacement — mirrors random.sample(population, k).
  sample<T>(items: readonly T[], k: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    for (let n = 0; n < k && pool.length > 0; n++) {
      const index = Math.floor(this.next() * pool.length);
      result.push(pool[index]);
      pool.splice(index, 1);
    }
    return result;
  }

  // In-place Fisher-Yates — mirrors random.shuffle(list).
  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}

// Exactly portable, unlike everything above — plain SHA-256 + modulo, matching Python's
// `_stable_index` precisely. No PRNG involved: used wherever a value must stay stable
// across runs regardless of how much unrelated RNG consumption happened earlier in the
// same script (see seed_daily_refresh.ts's template/book/member pairing).
export function stableIndex(key: string, modulus: number): number {
  const digest = createHash('sha256').update(key).digest('hex');
  return Number(BigInt(`0x${digest}`) % BigInt(modulus));
}
