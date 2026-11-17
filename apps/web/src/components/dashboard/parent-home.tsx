'use client';

import { CLOSED_WEEKDAYS, WORK_WEEK, type AuthUser, type ParentChildDto } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { Baby, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChildAvatar } from '@/components/children/child-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useFormatAge } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';

/** Saturday → Friday strip for the current week (Friday closed). */
function WeekStrip() {
  const t = useTranslations('parent');
  const tw = useTranslations('weekdays');
  const today = new Date();
  // Start of week = most recent Saturday.
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 1) % 7));
  const days = [...WORK_WEEK, ...CLOSED_WEEKDAYS].map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <ol className="grid grid-cols-7 gap-2" aria-label={t('thisWeek')}>
      {days.map((d) => {
        const closed = CLOSED_WEEKDAYS.includes(d.getDay());
        const isToday = d.toDateString() === today.toDateString();
        return (
          <li
            key={d.toISOString()}
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl py-3 text-center text-xs',
              isToday ? 'bg-brand-gradient text-white shadow-soft' : 'bg-card',
              closed && 'bg-muted text-muted-foreground',
            )}
          >
            <span className="font-medium">{tw(String(d.getDay()) as '0')}</span>
            <span className="text-lg font-semibold">{d.getDate()}</span>
            {closed && <span className="text-[10px]">{t('closed')}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function MyChildren() {
  const t = useTranslations('parentChildren');
  const tk = useTranslations('children');
  const age = useFormatAge();
  const locale = useLocale();
  const kids = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => api.get<ParentChildDto[]>('/parent/children'),
  });
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{t('title')}</h3>
      {kids.isLoading ? (
        <Skeleton className="h-24" />
      ) : !kids.data?.length ? (
        <p className="rounded-[20px] border border-dashed bg-card p-5 text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {kids.data.map((k) => (
            <li key={k.id}>
              <Card className="py-4">
                <CardContent className="flex items-center gap-4">
                  <ChildAvatar
                    src={k.hasPhoto ? `/parent/children/${k.id}/photo` : null}
                    name={k.fullName}
                    gender={k.gender}
                    className="size-14"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold">{k.fullName}</p>
                    <p className="text-sm text-muted-foreground">{age(k.birthDate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {(locale === 'en' && k.branch.nameEn) || k.branch.name}
                      {' · '}
                      {k.classroom?.name ?? tk('noClass')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ParentHome({ user }: { user: AuthUser }) {
  const t = useTranslations('parent');
  const tc = useTranslations('common');
  return (
    <div className="grid gap-6">
      <Card className="border-0 bg-brand-gradient text-white">
        <CardContent className="space-y-1">
          <h2 className="text-xl font-semibold">{t('greeting', { name: user.fullName })}</h2>
          <p className="text-white/85">{t('intro')}</p>
        </CardContent>
      </Card>
      <MyChildren />
      <section className="space-y-3">
        <h3 className="font-semibold">{t('thisWeek')}</h3>
        <WeekStrip />
      </section>
      <Card>
        <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-4">
          <span className="row-span-2 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Baby className="size-6" aria-hidden />
          </span>
          <CardTitle className="flex items-center gap-2">
            {t('enrollTitle')}
            <Badge variant="muted">
              <Clock aria-hidden />
              {tc('soon')}
            </Badge>
          </CardTitle>
          <CardDescription>{t('enrollBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled>{t('enrollCta')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
