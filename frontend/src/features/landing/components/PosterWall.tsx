import { cn } from '@/lib/cn';

const COLUMN_COUNT = 6;
const ROWS_PER_COLUMN = 5;

// Real cover art the user dropped into public/books — served by plain URL rather than a
// bundler-specific glob import (Vite's import.meta.glob has no Next.js equivalent), so this
// list is generated once from the directory contents rather than discovered at build time.
// Exported so other decorative poster layouts (e.g. the Login page's scrolling columns)
// reuse this same cover art instead of duplicating the list.
const COVER_FILES = [
  '1.jpg',
  '4.jpeg',
  '5.jpeg',
  '6.jpeg',
  '7.jpeg',
  '8.jpeg',
  '10.jpeg',
  '13.jpeg',
  '14.jpeg',
  '15.jpeg',
  '16.jpeg',
  '17.jpeg',
  '18.jpeg',
  '19.jpeg',
  '20.jpeg',
  '24.jpeg',
  '25.jpeg',
  '26.jpeg',
  '27.jpeg',
  '28.jpeg',
  '29.jpeg',
  '30.jpeg',
  '31.jpeg',
  '32.jpeg',
  '33.jpeg',
  '34.jpeg',
  '35.jpeg',
  '36.jpeg',
  '37.jpeg',
  '38.jpeg',
  '39.jpeg',
  '40.jpeg',
  '41.jpeg',
];
export const covers = COVER_FILES.map((file) => `/books/${file}`);

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
