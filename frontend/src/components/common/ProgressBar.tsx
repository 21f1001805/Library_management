import { cn } from '@/lib/cn';

export type ProgressBarTone = 'primary' | 'success' | 'warning' | 'danger';

const fillToneClasses: Record<ProgressBarTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export interface ProgressBarProps {
  percent: number;
  label?: string;
  tone?: ProgressBarTone;
  className?: string;
}

export function ProgressBar({ percent, label, tone = 'primary', className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground">{label}</span>
          <span className="text-muted-foreground">{Math.round(percent)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn('h-full rounded-full transition-all', fillToneClasses[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
