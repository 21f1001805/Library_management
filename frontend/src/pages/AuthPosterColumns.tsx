import { useEffect, useMemo, useRef } from 'react';

import { covers } from '@/features/landing/components/PosterWall';

const COLUMN_COUNT = 3;
const BASE_SPEED = 45; // px/second
const HOVER_SPEED_MULTIPLIER = 0.25;
const EASE_RATE = 4; // higher = snappier transition into/out of the hover-slow speed

interface MarqueeColumnProps {
  images: string[];
  direction: 1 | -1;
}

function MarqueeColumn({ images, direction }: MarqueeColumnProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const speedMultiplierRef = useRef(1);
  const targetMultiplierRef = useRef(1);
  const lastTimeRef = useRef<number | null>(null);

  // Duplicated so the track can loop seamlessly: wrapping at exactly half its scroll
  // height lands on an identical frame, since both halves render the same image list.
  const loopedImages = useMemo(() => [...images, ...images], [images]);

  useEffect(() => {
    let frameId: number;

    function tick(time: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      speedMultiplierRef.current +=
        (targetMultiplierRef.current - speedMultiplierRef.current) * Math.min(dt * EASE_RATE, 1);

      const track = trackRef.current;
      if (track) {
        const halfHeight = track.scrollHeight / 2;
        let offset = offsetRef.current + direction * BASE_SPEED * speedMultiplierRef.current * dt;
        if (offset <= -halfHeight) offset += halfHeight;
        if (offset > 0) offset -= halfHeight;
        offsetRef.current = offset;
        track.style.transform = `translateY(${offset}px)`;
      }

      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [direction]);

  return (
    <div
      className="relative h-full overflow-hidden"
      onMouseEnter={() => {
        targetMultiplierRef.current = HOVER_SPEED_MULTIPLIER;
      }}
      onMouseLeave={() => {
        targetMultiplierRef.current = 1;
      }}
    >
      <div ref={trackRef} className="flex flex-col gap-4 will-change-transform">
        {loopedImages.map((src, index) => (
          <img
            key={index}
            src={src}
            alt=""
            className="aspect-2/3 w-full rounded-xl object-cover shadow-xl ring-1 ring-white/10"
          />
        ))}
      </div>
    </div>
  );
}

// Decorative side panel shared by the Login and Register pages: three columns of book
// covers, the middle one scrolling opposite the outer two, both slowing to a crawl on
// hover rather than stopping.
export function AuthPosterColumns() {
  const columns = useMemo(() => {
    const perColumn = Math.ceil(covers.length / COLUMN_COUNT);
    return Array.from({ length: COLUMN_COUNT }, (_, i) =>
      covers.slice(i * perColumn, i * perColumn + perColumn),
    );
  }, []);

  return (
    <div aria-hidden className="grid h-full grid-cols-3 gap-4">
      {columns.map((images, index) => (
        <MarqueeColumn key={index} images={images} direction={index === 1 ? 1 : -1} />
      ))}
    </div>
  );
}
