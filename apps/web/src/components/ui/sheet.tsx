'use client';

import { XIcon } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;
export const SheetTitle = D.Title;

export function SheetContent({
  className,
  children,
  side = 'start',
  closeLabel = 'Close',
  ...props
}: React.ComponentProps<typeof D.Content> & {
  side?: 'start' | 'end' | 'bottom';
  closeLabel?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        aria-describedby={undefined}
        className={cn(
          'fixed z-50 flex flex-col bg-card shadow-xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300',
          side === 'start' &&
            'inset-y-0 start-0 h-full w-72 border-e data-[state=open]:slide-in-from-left rtl:data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-left rtl:data-[state=closed]:slide-out-to-right',
          side === 'end' &&
            'inset-y-0 end-0 h-full w-80 border-s data-[state=open]:slide-in-from-right rtl:data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-right rtl:data-[state=closed]:slide-out-to-left',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          className,
        )}
        {...props}
      >
        {children}
        <D.Close className="absolute end-3 top-3 rounded-lg p-1.5 opacity-70 transition hover:bg-accent hover:opacity-100">
          <XIcon className="size-4" />
          <span className="sr-only">{closeLabel}</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
