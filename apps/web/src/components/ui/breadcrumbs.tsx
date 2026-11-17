import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  label,
  className,
}: {
  items: Crumb[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn('text-sm text-muted-foreground', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {item.href && !last ? (
                  <Link href={item.href} className="transition hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={cn(last && 'font-medium text-foreground')}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden className="text-muted-foreground/60">
                  <ChevronRight className="size-3.5 rtl:rotate-180" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
