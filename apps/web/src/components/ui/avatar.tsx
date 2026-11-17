'use client';

import { Avatar as A } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
} & React.ComponentProps<'span'>) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  return (
    <A.Root className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}>
      {src ? (
        <A.Image src={src} alt={name} className="aspect-square size-full object-cover" />
      ) : null}
      <A.Fallback className="flex size-full items-center justify-center bg-brand-gradient text-xs font-semibold text-white">
        {initials}
      </A.Fallback>
    </A.Root>
  );
}
