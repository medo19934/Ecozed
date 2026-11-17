'use client';

import { Tooltip as T } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const TooltipProvider = T.Provider;

export function Tooltip({
  content,
  children,
  side = 'top',
  disabled,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-soft',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
