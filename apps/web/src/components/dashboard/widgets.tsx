'use client';

import { localDate, type CalendarEventDto, type ThreadDto } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MessageSquare, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Small linked stat card used by the role dashboards. */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  href?: string;
  tint: string;
}) {
  const body = (
    <Card
      className={cn(
        'relative h-full gap-2 overflow-hidden px-5 py-5',
        href && 'transition hover:-translate-y-0.5 hover:shadow-lg',
      )}
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ background: `linear-gradient(135deg, ${tint}, transparent 70%)` }}
        aria-hidden
      />
      <span
        className="relative flex size-10 items-center justify-center rounded-xl"
        style={{ background: `${tint}1f`, color: tint }}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="relative">
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-[20px] focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

/** Next 7 days of calendar items visible to the user. */
export function UpcomingEvents() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const from = localDate();
  const q = useQuery({
    queryKey: ['calendar', 'upcoming', from],
    queryFn: () => api.get<CalendarEventDto[]>(`/calendar?from=${from}&to=${addDays(from, 6)}`),
  });
  const items = (q.data ?? []).slice(0, 5);
  const day = (iso: string) =>
    iso === from
      ? t('today')
      : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
          weekday: 'long',
        }).format(new Date(`${iso}T00:00:00`));
  return (
    <Card className="h-fit gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarDays className="size-4 text-primary" /> {t('upcoming')}
        </p>
        <Link href="/calendar" className="text-sm text-primary">
          {t('seeAll')}
        </Link>
      </div>
      {q.isPending ? (
        <Skeleton className="h-24" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noEvents')}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((e) => (
            <li
              key={`${e.id}-${e.startDate}`}
              className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2"
            >
              <span
                className="h-8 w-1 rounded-full"
                style={{ background: e.classroom?.color ?? '#5b6db4' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {day(e.startDate)}
                  {e.startTime ? ` · ${e.startTime}` : ''}
                  {e.classroom ? ` · ${e.classroom.name}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Latest conversations with unread counts. */
export function LatestMessages() {
  const t = useTranslations('dashboard');
  const q = useQuery({
    queryKey: ['messages', 'threads', 'all', ''],
    queryFn: () => api.get<ThreadDto[]>('/messages/threads?tab=all'),
  });
  const items = (q.data ?? []).slice(0, 4);
  return (
    <Card className="h-fit gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <MessageSquare className="size-4 text-primary" /> {t('latestMessages')}
        </p>
        <Link href="/messages" className="text-sm text-primary">
          {t('seeAll')}
        </Link>
      </div>
      {q.isPending ? (
        <Skeleton className="h-24" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noMessages')}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((th) => (
            <li key={th.id}>
              <Link
                href="/messages"
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{th.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {th.lastMessage
                      ? `${th.lastMessage.senderName}: ${th.lastMessage.body ?? '📎'}`
                      : (th.subtitle ?? '')}
                  </span>
                </span>
                {th.unread > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                    {th.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
