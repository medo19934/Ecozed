'use client';

import { Switch as S } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent bg-input transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50 data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5" />
    </S.Root>
  );
}
