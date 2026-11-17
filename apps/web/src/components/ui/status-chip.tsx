import { cn } from '@/lib/utils';

const tone = {
  green: 'bg-success/12 text-success',
  amber: 'bg-warning/15 text-[#b8711a]',
  red: 'bg-destructive/10 text-destructive',
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-primary/10 text-primary',
} as const;

/** Pill status chip (green accepted/paid, amber review, red rejected/unpaid). */
export function StatusChip({
  color,
  children,
  className,
}: {
  color: keyof typeof tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TestBadge() {
  return (
    <span className="rounded-md border border-warning/60 bg-warning/15 px-1.5 text-[10px] font-bold tracking-wide text-[#b8711a]">
      TEST
    </span>
  );
}
