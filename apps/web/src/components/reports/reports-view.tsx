'use client';

import { localDate } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/page-header';
import { useSar } from '@/components/subscriptions/subscriptions-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';

interface ReportData {
  from: string;
  to: string;
  attendance: { date: string; ATTENDED: number; ABSENT: number; VACATION: number }[];
  payments: { paid: number; unpaid: number; paidAmount: number; unpaidAmount: number };
  admissions: { total: number; underReview: number; accepted: number; rejected: number };
  occupancy: { name: string; capacity: number; children: number }[];
}

const back = (days: number) => {
  const d = new Date(`${localDate()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

/** CSV with a BOM so Excel opens Arabic correctly. */
function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView() {
  const t = useTranslations('reports');
  const tn = useTranslations('nav');
  const sar = useSar();
  const [from, setFrom] = useState(back(29));
  const [to, setTo] = useState(localDate());
  const q = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => api.get<ReportData>(`/reports?from=${from}&to=${to}`),
  });
  const d = q.data;

  const exportAll = () => {
    if (!d) return;
    downloadCsv(`latif-kids-report-${d.from}_${d.to}.csv`, [
      [t('attendance')],
      [t('date'), t('attended'), t('absent'), t('vacation')],
      ...d.attendance.map((a) => [a.date, a.ATTENDED, a.ABSENT, a.VACATION]),
      [],
      [t('payments')],
      [t('paid'), d.payments.paid, d.payments.paidAmount],
      [t('unpaid'), d.payments.unpaid, d.payments.unpaidAmount],
      [],
      [t('admissions')],
      [t('total'), d.admissions.total],
      [t('underReview'), d.admissions.underReview],
      [t('accepted'), d.admissions.accepted],
      [t('rejected'), d.admissions.rejected],
      [],
      [t('occupancy')],
      [t('class'), t('children'), t('capacity')],
      ...d.occupancy.map((c) => [c.name, c.children, c.capacity]),
    ]);
  };

  const Stat = ({
    label,
    value,
    tone,
  }: {
    label: string;
    value: string | number;
    tone?: string;
  }) => (
    <div className="rounded-2xl bg-muted/60 p-4">
      <p className="text-2xl font-bold" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
        actions={
          <Button variant="outline" onClick={exportAll} disabled={!d}>
            <Download /> {t('export')}
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          type="date"
          className="w-44"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={t('from')}
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          className="w-44"
          value={to}
          min={from}
          max={localDate()}
          onChange={(e) => setTo(e.target.value)}
          aria-label={t('to')}
        />
      </div>
      {!d ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="grid gap-4 p-5 lg:col-span-2">
            <h2 className="font-semibold">{t('attendance')}</h2>
            {d.attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              <div className="h-72" dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={d.attendance}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="ATTENDED"
                      name={t('attended')}
                      stackId="a"
                      fill="#9eca9e"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar dataKey="VACATION" name={t('vacation')} stackId="a" fill="#f2a33a" />
                    <Bar
                      dataKey="ABSENT"
                      name={t('absent')}
                      stackId="a"
                      fill="#e5484d"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card className="grid gap-4 p-5">
            <h2 className="font-semibold">{t('payments')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={t('paidCount', { n: d.payments.paid })}
                value={sar(d.payments.paidAmount)}
                tone="#2fb36d"
              />
              <Stat
                label={t('unpaidCount', { n: d.payments.unpaid })}
                value={sar(d.payments.unpaidAmount)}
                tone="#e5484d"
              />
            </div>
          </Card>
          <Card className="grid gap-4 p-5">
            <h2 className="font-semibold">{t('admissions')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('total')} value={d.admissions.total} />
              <Stat label={t('underReview')} value={d.admissions.underReview} tone="#b8711a" />
              <Stat label={t('accepted')} value={d.admissions.accepted} tone="#2fb36d" />
              <Stat label={t('rejected')} value={d.admissions.rejected} tone="#e5484d" />
            </div>
          </Card>
          <Card className="grid gap-4 p-5 lg:col-span-2">
            <h2 className="font-semibold">{t('occupancy')}</h2>
            {d.occupancy.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {d.occupancy.map((c) => {
                  const pct = c.capacity
                    ? Math.min(100, Math.round((c.children / c.capacity) * 100))
                    : 0;
                  return (
                    <div key={c.name} className="grid gap-2 rounded-2xl border p-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">
                          {c.children}/{c.capacity}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-gradient"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
