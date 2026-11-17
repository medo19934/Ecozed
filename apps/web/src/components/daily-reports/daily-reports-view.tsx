'use client';

import { localDate, type DailyReportDto } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, NotebookPen, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { useClasses } from '@/lib/queries';
import { useErrorMessage } from '@/lib/use-error-message';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

const MEALS = ['BREAKFAST', 'SNACK', 'LUNCH'] as const;
const AMOUNTS = ['ALL', 'MOST', 'SOME', 'NONE'] as const;
const MOODS = { HAPPY: '😊', CALM: '🙂', TIRED: '😴', SAD: '😢', UPSET: '😣' } as const;
type Meal = DailyReportDto['meals'][number];

export function DailyReportsPage() {
  const { data: user } = useSession();
  if (!user) return <Skeleton className="h-48" />;
  return user.role === 'PARENT' ? <ParentReports /> : <StaffReports />;
}

function ReportSummary({ r }: { r: DailyReportDto }) {
  const t = useTranslations('dailyReports');
  return (
    <ul className="grid gap-1.5 text-sm">
      {r.meals.map((m) => (
        <li key={m.meal}>
          🍽️ {t(`meals.${m.meal}`)}: {t(`amounts.${m.amount}`)}
        </li>
      ))}
      {r.napMinutes != null && <li>😴 {t('napValue', { n: r.napMinutes })}</li>}
      {r.toilet != null && <li>🚻 {t('toiletValue', { n: r.toilet })}</li>}
      {r.mood && (
        <li>
          {MOODS[r.mood]} {t(`moods.${r.mood}`)}
        </li>
      )}
      {r.activities && <li>🎨 {r.activities}</li>}
      {r.notes && <li>📝 {r.notes}</li>}
    </ul>
  );
}

function ParentReports() {
  const t = useTranslations('dailyReports');
  const tn = useTranslations('nav');
  const fmt = useFormatDate();
  const q = useQuery({
    queryKey: ['daily-reports', 'mine'],
    queryFn: () => api.get<DailyReportDto[]>('/daily-reports/mine'),
  });
  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('home'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      {q.isPending ? (
        <Skeleton className="h-48" />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={NotebookPen} title={t('parentEmpty')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data!.map((r) => (
            <Card key={`${r.child.id}-${r.date}`} className="grid gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.child.fullName}</p>
                  <p className="text-sm text-muted-foreground">{fmt(r.date)}</p>
                </div>
                {r.author && <span className="text-xs text-muted-foreground">{r.author}</span>}
              </div>
              <ReportSummary r={r} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function StaffReports() {
  const t = useTranslations('dailyReports');
  const tn = useTranslations('nav');
  const classes = useClasses();
  const [date, setDate] = useState(localDate());
  const [classroomId, setClassroomId] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['daily-reports', date, classroomId],
    queryFn: () =>
      api.get<DailyReportDto[]>(
        `/daily-reports?date=${date}${classroomId ? `&classroomId=${classroomId}` : ''}`,
      ),
  });
  const rows = q.data ?? [];
  const current = rows.find((r) => r.child.id === selected) ?? rows[0];
  const done = rows.filter((r) => r.sharedAt).length;

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="date"
          className="w-44"
          value={date}
          max={localDate()}
          onChange={(e) => setDate(e.target.value)}
          aria-label={t('date')}
        />
        <Select
          className="w-52"
          value={classroomId}
          onChange={(e) => setClassroomId(e.target.value)}
          aria-label={t('class')}
        >
          <option value="">{t('allClasses')}</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {rows.length > 0 && (
          <StatusChip color={done === rows.length ? 'green' : 'amber'}>
            {t('progress', { done, total: rows.length })}
          </StatusChip>
        )}
      </div>
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState icon={NotebookPen} title={t('staffEmpty')} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <Card className="h-fit max-h-[70dvh] overflow-y-auto p-2">
            {rows.map((r) => (
              <button
                key={r.child.id}
                type="button"
                onClick={() => setSelected(r.child.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-muted',
                  current?.child.id === r.child.id && 'bg-secondary',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.child.fullName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.child.classroom ?? '—'}
                  </span>
                </span>
                {r.sharedAt ? (
                  <CheckCircle2 className="size-5 text-success" aria-label={t('shared')} />
                ) : r.id ? (
                  <StatusChip color="amber">{t('draft')}</StatusChip>
                ) : null}
              </button>
            ))}
          </Card>
          {current && (
            <ReportForm key={`${current.child.id}-${date}-${current.updatedAt}`} report={current} />
          )}
        </div>
      )}
    </>
  );
}

function ReportForm({ report }: { report: DailyReportDto }) {
  const t = useTranslations('dailyReports');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [meals, setMeals] = useState<Partial<Record<Meal['meal'], Meal['amount']>>>({});
  const [f, setF] = useState({ napMinutes: '', toilet: '', mood: '', activities: '', notes: '' });
  useEffect(() => {
    setMeals(Object.fromEntries(report.meals.map((m) => [m.meal, m.amount])));
    setF({
      napMinutes: report.napMinutes?.toString() ?? '',
      toilet: report.toilet?.toString() ?? '',
      mood: report.mood ?? '',
      activities: report.activities ?? '',
      notes: report.notes ?? '',
    });
  }, [report]);
  const save = useMutation({
    mutationFn: (share: boolean) =>
      api.put<DailyReportDto>('/daily-reports', {
        childId: report.child.id,
        date: report.date,
        meals: MEALS.filter((m) => meals[m]).map((m) => ({ meal: m, amount: meals[m] })),
        napMinutes: f.napMinutes === '' ? null : Number(f.napMinutes),
        toilet: f.toilet === '' ? null : Number(f.toilet),
        mood: f.mood || null,
        activities: f.activities,
        notes: f.notes,
        share,
      }),
    onSuccess: (_r, share) => {
      void qc.invalidateQueries({ queryKey: ['daily-reports'] });
      void qc.invalidateQueries({ queryKey: ['messages'] });
      toast.success(share ? t('sharedToast') : tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className="grid gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{report.child.fullName}</h2>
        {report.sharedAt ? (
          <StatusChip color="green">{t('shared')}</StatusChip>
        ) : report.id ? (
          <StatusChip color="amber">{t('draft')}</StatusChip>
        ) : null}
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">{t('mealsTitle')}</legend>
        {MEALS.map((m) => (
          <div key={m} className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-sm">{t(`meals.${m}`)}</span>
            {AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setMeals((s) => ({ ...s, [m]: s[m] === a ? undefined : a }))}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  meals[m] === a ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                )}
              >
                {t(`amounts.${a}`)}
              </button>
            ))}
          </div>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="dr-nap" label={t('nap')}>
          <Input
            id="dr-nap"
            type="number"
            min={0}
            max={600}
            dir="ltr"
            value={f.napMinutes}
            onChange={(e) => setF({ ...f, napMinutes: e.target.value })}
          />
        </FormField>
        <FormField id="dr-toilet" label={t('toilet')}>
          <Input
            id="dr-toilet"
            type="number"
            min={0}
            max={30}
            dir="ltr"
            value={f.toilet}
            onChange={(e) => setF({ ...f, toilet: e.target.value })}
          />
        </FormField>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('mood')}</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MOODS) as (keyof typeof MOODS)[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setF({ ...f, mood: f.mood === m ? '' : m })}
              className={cn(
                'rounded-2xl border px-3 py-2 text-sm',
                f.mood === m ? 'border-primary bg-secondary' : 'bg-card',
              )}
            >
              <span className="text-lg">{MOODS[m]}</span> {t(`moods.${m}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <FormField id="dr-act" label={t('activities')}>
        <Textarea
          id="dr-act"
          rows={2}
          value={f.activities}
          onChange={(e) => setF({ ...f, activities: e.target.value })}
        />
      </FormField>
      <FormField id="dr-notes" label={t('notes')}>
        <Textarea
          id="dr-notes"
          rows={2}
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </FormField>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(false)}>
          {tc('save')}
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
          <Send className="rtl:-scale-x-100" /> {t('share')}
        </Button>
      </div>
    </Card>
  );
}
