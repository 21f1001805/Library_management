import { cn } from '@/lib/cn';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendLineChartProps {
  data: TrendPoint[];
  /** CSS color value, e.g. 'var(--color-primary)'. */
  color?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const CHART_PADDING = 12;

export function TrendLineChart({
  data,
  color = 'var(--color-primary)',
  valueFormatter,
  className,
}: TrendLineChartProps) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const coords = data.map((d, i) => {
    const x =
      data.length === 1
        ? CHART_WIDTH / 2
        : CHART_PADDING + (i / (data.length - 1)) * (CHART_WIDTH - CHART_PADDING * 2);
    const y = CHART_HEIGHT - CHART_PADDING - ((d.value - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
    return { x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${CHART_HEIGHT - CHART_PADDING} L ${coords[0].x} ${CHART_HEIGHT - CHART_PADDING} Z`;
  const showZeroLine = min < 0 && max > 0;
  const zeroY = CHART_HEIGHT - CHART_PADDING - ((0 - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
        role="img"
      >
        {showZeroLine && (
          <line
            x1={CHART_PADDING}
            y1={zeroY}
            x2={CHART_WIDTH - CHART_PADDING}
            y2={zeroY}
            stroke="var(--color-border)"
            strokeDasharray="4 4"
          />
        )}
        <path d={areaPath} fill={color} opacity={0.12} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3.5} fill={color} stroke="var(--color-surface)" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="flex justify-between px-0.5 text-[10px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
      {valueFormatter && (
        <div className="flex justify-between px-0.5 text-[10px] font-medium text-foreground">
          {data.map((d) => (
            <span key={d.label}>{valueFormatter(d.value)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

