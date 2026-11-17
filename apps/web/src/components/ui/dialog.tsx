'use client';

import { XIcon } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  closeLabel,
  ...props
}: React.ComponentProps<typeof D.Content> & {
  title: string;
  description?: string;
  closeLabel: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        aria-describedby={description ? undefined : undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[20px] bg-card shadow-xl sm:inset-auto sm:start-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-y-1/2 sm:rounded-[20px] ltr:sm:-translate-x-1/2 rtl:sm:translate-x-1/2',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="space-y-1">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="text-sm text-muted-foreground">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="rounded-lg p-1.5 opacity-70 transition hover:bg-accent hover:opacity-100">
            <XIcon className="size-4" />
            <span className="sr-only">{closeLabel}</span>
          </D.Close>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-6 flex flex-wrap justify-end gap-2', className)} {...props} />;
}
