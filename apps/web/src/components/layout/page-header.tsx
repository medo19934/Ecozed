import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';

export function PageHeader({
  title,
  description,
  crumbs,
  crumbsLabel,
  actions,
}: {
  title: string;
  description?: string;
  crumbs: Crumb[];
  crumbsLabel: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-3">
      <Breadcrumbs items={crumbs} label={crumbsLabel} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}
