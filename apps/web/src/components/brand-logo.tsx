import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandLogo({
  name,
  compact,
  className,
}: {
  name: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-semibold', className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
        <Sparkles className="size-5" aria-hidden />
      </span>
      {!compact && <span className="text-lg tracking-tight">{name}</span>}
    </span>
  );
}
