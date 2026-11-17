'use client';

import { DropdownMenu as DM } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;
export const DropdownMenuRadioGroup = DM.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-soft',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof DM.Item> & { variant?: 'destructive' }) {
  return (
    <DM.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4",
        variant === 'destructive' &&
          'text-destructive focus:bg-destructive/10 focus:text-destructive',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-lg py-2 ps-7 pe-2.5 text-sm outline-none focus:bg-accent',
        className,
      )}
      {...props}
    >
      <span className="absolute start-2.5 flex size-2 items-center justify-center">
        <DM.ItemIndicator>
          <span className="block size-2 rounded-full bg-primary" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return (
    <DM.Label
      className={cn('px-2.5 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} {...props} />;
}
