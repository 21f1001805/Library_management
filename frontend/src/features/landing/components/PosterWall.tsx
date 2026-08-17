import { cn } from '@/lib/cn';

const COLUMN_COUNT = 6;
const ROWS_PER_COLUMN = 5;

// Real cover art the user dropped into src/assets/books — no captions needed, the covers
// already carry their own titles.
const coverModules = import.meta.glob<{ default: string }>('../../../assets/books/*', {
  eager: true,
});
// Exported so other decorative poster layouts (e.g. the Login page's scrolling columns)
// reuse this same cover art instead of duplicating the glob.
export const covers = Object.values(coverModules).map((mod) => mod.default);

function buildColumns(images: string[]): string[][] {
  const columns: string[][] = Array.from({ length: COLUMN_COUNT }, () => []);
  for (let i = 0; i < COLUMN_COUNT * ROWS_PER_COLUMN; i++) {
    columns[i % COLUMN_COUNT].push(images[i % images.length]);
  }
  return columns;
}

const columns = buildColumns(covers);

// Three offset tiers (not just even/odd) so tile tops don't line up into a hard row —
// a flat two-tier stagger reads as a visible seam across the wall.
const COLUMN_OFFSETS = [
  '',
  'translate-y-12 sm:translate-y-16 lg:translate-y-20',
  'translate-y-24 sm:translate-y-32 lg:translate-y-40',
];

function PosterTile({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="aspect-2/3 w-full rounded-xl object-cover shadow-xl ring-1 ring-white/10"
    />
  );
}

// Purely decorative background wall behind the Hero heading.
export function PosterWall() {
  return (
    <div
      aria-hidden
      className="mx-auto grid max-w-7xl grid-cols-4 gap-3 sm:gap-4 lg:grid-cols-6 lg:gap-5"
    >
      {columns.map((columnCovers, columnIndex) => (
        <div
          key={columnIndex}
          className={cn(
            'flex flex-col gap-3 sm:gap-4 lg:gap-5',
            columnIndex >= 4 && 'hidden lg:flex',
            COLUMN_OFFSETS[columnIndex % 3],
          )}
        >
          {columnCovers.map((src, rowIndex) => (
            <PosterTile key={`${columnIndex}-${rowIndex}`} src={src} />
          ))}
        </div>
      ))}
    </div>
  );
}
