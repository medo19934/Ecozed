import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        success: 'bg-success/12 text-success',
        warning: 'bg-warning/15 text-[oklch(0.5_0.12_70)]',
        destructive: 'bg-destructive/10 text-destructive',
        muted: 'bg-muted text-muted-foreground',
        outline: 'border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
