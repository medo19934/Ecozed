'use client';

import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center px-4', collapsed && 'justify-center px-0')}>
        <Link href="/dashboard" aria-label={tc('appName')} onClick={onNavigate}>
          <BrandLogo name={tc('appName')} compact={collapsed} />
        </Link>
      </div>
      <nav aria-label={t('home')} className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="grid gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const label = t(item.key);
            const body = (
              <>
                <span className="relative">
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {item.unreadDot && !item.soon && (
                    <span className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                  )}
                </span>
                {!collapsed && <span className="flex-1 truncate">{label}</span>}
                {!collapsed && item.soon && <Badge variant="muted">{tc('soon')}</Badge>}
              </>
            );
            const cls = cn(
              'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
              collapsed && 'justify-center px-0',
              active
                ? 'bg-brand-gradient text-white shadow-soft'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              item.soon &&
                'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground',
            );
            return (
              <li key={item.key}>
                <Tooltip content={label} side="right" disabled={!collapsed}>
                  {item.soon ? (
                    <span
                      className={cls}
                      aria-disabled="true"
                      aria-label={collapsed ? label : undefined}
                    >
                      {body}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className={cls}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? label : undefined}
                      onClick={onNavigate}
                    >
                      {body}
                    </Link>
                  )}
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
