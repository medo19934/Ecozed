'use client';

import type { DailyReportDto, SubscriptionDto } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, NotebookPen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSar } from '@/components/subscriptions/subscriptions-view';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { LatestMessages, UpcomingEvents } from './widgets';

const MOODS = { HAPPY: '😊', CALM: '🙂', TIRED: '😴', SAD: '😢', UPSET: '😣' } as const;

/** Parent: latest daily report per child, fees status, upcoming events, messages. */
export function ParentOverview() {
  const t = useTranslations('dashboard');
  const td = useTranslations('dailyReports');
  const ts = useTranslations('subscriptions');
  const fmt = useFormatDate();
  const sar = useSar();
  const reports = useQuery({
    queryKey: ['daily-reports', 'mine'],
    queryFn: () => api.get<DailyReportDto[]>('/daily-reports/mine'),
  });
  const subs = useQuery({
    queryKey: ['subscriptions', 'mine'],
    queryFn: () => api.get<SubscriptionDto[]>('/subscriptions/mine'),
  });
  // Latest report of each child (list is newest first).
  const latestByChild = (reports.data ?? []).reduce<DailyReportDto[]>(
    (acc, r) => (acc.some((x) => x.child.id === r.child.id) ? acc : [...acc, r]),
    [],
  );
  const fees = (subs.data ?? []).filter((s) => s.status !== 'CANCELED').slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="gap-3 p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold">
            <NotebookPen className="size-4 text-primary" /> {t('latestReports')}
          </p>
          <Link href="/daily-reports" className="text-sm text-primary">
            {t('seeAll')}
          </Link>
        </div>
        {reports.isPending ? (
          <Skeleton className="h-24" />
        ) : latestByChild.length === 0 ? (
          <p className="text-sm text-muted-foreground">{td('parentEmpty')}</p>
        ) : (
          latestByChild.map((r) => (
            <div key={r.child.id} className="rounded-2xl bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.child.fullName}</span>
                <span className="text-xs text-muted-foreground">{fmt(r.date)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {r.mood ? `${MOODS[r.mood]} ${td(`moods.${r.mood}`)}` : ''}
                {r.napMinutes != null ? ` · 😴 ${td('napValue', { n: r.napMinutes })}` : ''}
                {r.meals.length
                  ? ` · 🍽️ ${r.meals.map((m) => `${td(`meals.${m.meal}`)}: ${td(`amounts.${m.amount}`)}`).join('، ')}`
                  : ''}
              </p>
              {r.activities && <p className="mt-1 text-sm">🎨 {r.activities}</p>}
            </div>
          ))
        )}
      </Card>
      <Card className="gap-3 p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold">
            <CreditCard className="size-4 text-primary" /> {t('fees')}
          </p>
          <Link href="/subscriptions" className="text-sm text-primary">
            {t('seeAll')}
          </Link>
        </div>
        {subs.isPending ? (
          <Skeleton className="h-24" />
        ) : fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ts('mineEmpty')}</p>
        ) : (
          fees.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-muted/50 p-3"
            >
              <span className="min-w-0">
                <span className="block font-medium">{s.child.fullName}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.plan?.name ?? ''} · {sar(s.value)} · {fmt(s.endDate)}
                </span>
              </span>
              <StatusChip color={s.paymentStatus === 'PAID' ? 'green' : 'red'}>
                {ts(`pay.${s.paymentStatus}`)}
              </StatusChip>
            </div>
          ))
        )}
      </Card>
      <UpcomingEvents />
      <LatestMessages />
    </div>
  );
}
