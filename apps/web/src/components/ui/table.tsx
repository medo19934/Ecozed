import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
export const THead = (p: React.ComponentProps<'thead'>) => (
  <thead className="[&_tr]:border-b" {...p} />
);
export const TBody = (p: React.ComponentProps<'tbody'>) => (
  <tbody className="[&_tr:last-child]:border-0" {...p} />
);
export function Tr({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />
  );
}
export function Th({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-11 whitespace-nowrap px-4 text-start align-middle text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
export function Td({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}
