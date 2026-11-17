'use client';

import { localDate, type DashboardAttendance, type DayStatus } from '@latif/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useClasses } from '@/lib/queries';

/** Reference status colours (SPEC rev. 1). Identity is also carried by the labelled legend. */
export const STATUS_COLORS: Record<DayStatus, string> = {
  NO_RECORD: '#c4c9d2',
  ABSENT: '#e5484d',
  VACATION: '#f2a33a',
  DEPARTURE: '#3f4660',
  ATTENDED: '#9eca9e',
};
const ORDER: DayStatus[] = ['NO_RECORD', 'ABSENT', 'VACATION', 'DEPARTURE', 'ATTENDED'];

export function AttendanceDonut({ scope }: { scope: 'branch' | 'all' }) {
  const t = useTranslations('dashboard');
  const ts = useTranslations('status');
  const f = useFormatter();
  const classes = useClasses();
  const [date, setDate] = useState(() => localDate());
  const [classroomId, setClassroomId] = useState('');
  const params = new URLSearchParams({
    date,
    scope,
    ...(classroomId && scope === 'branch' ? { classroomId } : {}),
  });
  const q = useQuery({
    queryKey: ['dashboard', 'attendance', params.toString()],
    queryFn: () => api.get<DashboardAttendance>(`/dashboard/attendance?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const d = q.data;
  const data = d ? ORDER.map((k) => ({ key: k, name: ts(k), value: d.counts[k] })) : [];

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{t('attendanceTitle')}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {scope === 'branch' && (
            <Select
              aria-label={t('class')}
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="h-9 w-40"
            >
              <option value="">{t('allClasses')}</option>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <Input
            aria-label={t('date')}
            type="date"
            value={date}
            max={localDate()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 w-40"
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-medium text-primary hover:bg-accent"
          >
            <RefreshCw className={`size-3.5 ${q.isFetching ? 'animate-spin' : ''}`} aria-hidden />
            {t('refresh')}
          </button>
          {d && (
            <span>
              {t('lastUpdated', {
                time: f.dateTime(new Date(d.updatedAt), { timeStyle: 'short' }),
              })}
            </span>
          )}
        </div>
        {!d ? (
          <Skeleton className="mx-auto size-56 rounded-full" />
        ) : d.total === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t('noChildren')}</p>
        ) : (
          <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
            <div
              className="relative mx-auto size-60"
              role="img"
              aria-label={`${t('attendanceTitle')}: ${data.map((x) => `${x.name} ${x.value}`).join('، ')}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.filter((x) => x.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="72%"
                    outerRadius="100%"
                    paddingAngle={data.filter((x) => x.value > 0).length > 1 ? 2 : 0}
                    cornerRadius={4}
                    stroke="var(--card)"
                    strokeWidth={2}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={false}
                  >
                    {data
                      .filter((x) => x.value > 0)
                      .map((x) => (
                        <Cell key={x.key} fill={STATUS_COLORS[x.key]} />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [String(v), String(n)]}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--popover)',
                      color: 'var(--foreground)',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm text-muted-foreground">{t('total')}</span>
                <span className="text-4xl font-bold">{d.total}</span>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5 md:grid-cols-2 xl:grid-cols-5">
              {data.map((x) => (
                <li
                  key={x.key}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-muted/50 p-3 text-center"
                >
                  <span className="text-2xl font-semibold">{x.value}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: STATUS_COLORS[x.key] }}
                      aria-hidden
                    />
                    {x.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
