'use client';

import { localDate, type AdmissionDto, type AdmissionListResponse } from '@latif/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleCheck,
  CircleX,
  ClipboardList,
  Hourglass,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useDualDate, useFormatAge } from '@/lib/format';
import { useClasses } from '@/lib/queries';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';

type Period = 'all' | 'today' | 'week' | 'month' | 'year';
const daysBack: Record<Exclude<Period, 'all'>, number> = {
  today: 0,
  week: 7,
  month: 30,
  year: 365,
};
export const ADMISSION_COLOR = {
  UNDER_REVIEW: 'amber',
  ACCEPTED: 'green',
  REJECTED: 'red',
} as const;

function Kpi({
  icon: Icon,
  label,
  value,
  tint,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  tint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-[20px] border bg-card p-5 text-start shadow-soft transition hover:-translate-y-0.5',
        active && 'ring-2 ring-primary',
      )}
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ background: `linear-gradient(135deg, ${tint}, transparent 70%)` }}
        aria-hidden
      />
      <span
        className="relative mb-3 flex size-10 items-center justify-center rounded-xl"
        style={{ background: `${tint}1f`, color: tint }}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="relative text-3xl font-bold">{value ?? '—'}</p>
      <p className="relative text-sm text-muted-foreground">{label}</p>
    </button>
  );
}

function AcceptDialog({ a, onClose }: { a: AdmissionDto | null; onClose: () => void }) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const tk = useTranslations('children');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const classes = useClasses();
  const [classroomId, setClassroomId] = useState('');
  const accept = useMutation({
    mutationFn: () =>
      api.post<AdmissionDto>(`/admissions/${a!.id}/accept`, { classroomId: classroomId || null }),
    onSuccess: () => {
      toast.success(tc('saved'));
      void qc.invalidateQueries({ queryKey: ['admissions'] });
      void qc.invalidateQueries({ queryKey: ['children'] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      {a && (
        <DialogContent title={t('acceptTitle')} closeLabel={tc('close')}>
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {t('acceptBody', { child: a.childName })}
            </p>
            <Select
              aria-label={tk('class')}
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
            >
              <option value="">{tk('noClass')}</option>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id} disabled={c.childrenCount >= c.capacity}>
                  {c.name} ({c.childrenCount}/{c.capacity})
                </option>
              ))}
            </Select>
            <DialogFooter>
              <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
                <Check /> {t('accept')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

function RejectDialog({ a, onClose }: { a: AdmissionDto | null; onClose: () => void }) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () =>
      api.post<AdmissionDto>(`/admissions/${a!.id}/reject`, {
        reason: reason || t('reasonDefault'),
      }),
    onSuccess: () => {
      toast.success(tc('saved'));
      void qc.invalidateQueries({ queryKey: ['admissions'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      {a && (
        <DialogContent title={t('rejectTitle')} description={a.childName} closeLabel={tc('close')}>
          <div className="grid gap-4">
            <FormField id="reason" label={t('reasonLabel')}>
              <Textarea
                id="reason"
                rows={4}
                placeholder={t('reasonDefault')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </FormField>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => reject.mutate()}
                disabled={reject.isPending}
              >
                <X /> {t('reject')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function AdmissionsView() {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const ts = useTranslations('status');
  const tk = useTranslations('children');
  const age = useFormatAge();
  const dual = useDualDate();
  const errorMessage = useErrorMessage();
  const canAccept = useCan('canAddChild');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [accepting, setAccepting] = useState<AdmissionDto | null>(null);
  const [rejecting, setRejecting] = useState<AdmissionDto | null>(null);
  const q = useDeferredValue(search);

  const pickPeriod = (p: Period) => {
    setPeriod(p);
    setPage(1);
    if (p === 'all') {
      setFrom('');
      setTo('');
      return;
    }
    const start = new Date();
    start.setDate(start.getDate() - daysBack[p]);
    setFrom(localDate(start));
    setTo(localDate());
  };

  const params = new URLSearchParams({
    page: String(page),
    pageSize: '20',
    ...(q ? { search: q } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const list = useQuery({
    queryKey: ['admissions', params.toString()],
    queryFn: () => api.get<AdmissionListResponse>(`/admissions?${params}`),
    placeholderData: keepPreviousData,
  });
  const c = list.data?.counts;

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi
          icon={ClipboardList}
          label={t('cards.total')}
          value={c?.total}
          tint="#5b6db4"
          active={!status}
          onClick={() => {
            setStatus('');
            setPage(1);
          }}
        />
        <Kpi
          icon={Hourglass}
          label={t('cards.UNDER_REVIEW')}
          value={c?.UNDER_REVIEW}
          tint="#f2a33a"
          active={status === 'UNDER_REVIEW'}
          onClick={() => {
            setStatus('UNDER_REVIEW');
            setPage(1);
          }}
        />
        <Kpi
          icon={CircleCheck}
          label={t('cards.ACCEPTED')}
          value={c?.ACCEPTED}
          tint="#2fb36d"
          active={status === 'ACCEPTED'}
          onClick={() => {
            setStatus('ACCEPTED');
            setPage(1);
          }}
        />
        <Kpi
          icon={CircleX}
          label={t('cards.REJECTED')}
          value={c?.REJECTED}
          tint="#e5484d"
          active={status === 'REJECTED'}
          onClick={() => {
            setStatus('REJECTED');
            setPage(1);
          }}
        />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap gap-2 border-b px-4 pt-4 pb-3">
          {(['all', 'today', 'week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => pickPeriod(p)}
              className="rounded-full border px-3 py-1.5 text-sm transition aria-pressed:border-transparent aria-pressed:bg-brand-gradient aria-pressed:text-white"
            >
              {t(`periods.${p}`)}
            </button>
          ))}
        </div>
        <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_170px_150px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t('searchPlaceholder')}
              placeholder={t('searchPlaceholder')}
              className="ps-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label={tc('status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {tc('status')}: {tc('all')}
            </option>
            {(['UNDER_REVIEW', 'ACCEPTED', 'REJECTED'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`cards.${s}`)}
              </option>
            ))}
          </Select>
          <Input
            aria-label={t('from')}
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPeriod('all');
              setPage(1);
            }}
          />
          <Input
            aria-label={t('to')}
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPeriod('all');
              setPage(1);
            }}
          />
        </div>
        {list.isLoading ? (
          <div className="grid gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : list.isError ? (
          <EmptyState icon={ClipboardList} title={errorMessage(list.error)} />
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={ClipboardList}
            title={q || status || from || to ? tc('noResults') : t('empty')}
          />
        ) : (
          <>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>{t('number')}</Th>
                  <Th>{t('child')}</Th>
                  <Th>{t('guardian')}</Th>
                  <Th>{t('submitted')}</Th>
                  <Th>{t('phone')}</Th>
                  <Th>{t('email')}</Th>
                  <Th>{tc('status')}</Th>
                  <Th className="text-end">{tc('actions')}</Th>
                </Tr>
              </THead>
              <TBody>
                {list.data.items.map((a) => {
                  const d = dual(a.createdAt);
                  return (
                    <Tr key={a.id}>
                      <Td className="text-muted-foreground" dir="ltr">
                        {a.number}
                      </Td>
                      <Td>
                        <p className="font-medium">{a.childName}</p>
                        <p className="text-xs text-muted-foreground">
                          {tk(`genders.${a.childGender}`)} · {age(a.childBirthDate)}
                        </p>
                      </Td>
                      <Td>
                        <p>{a.guardianName}</p>
                        <p className="text-xs text-muted-foreground">{a.relationship}</p>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">
                        <p>{d.gregorian}</p>
                        {d.hijri && <p className="text-muted-foreground">{d.hijri}</p>}
                        <p className="text-muted-foreground">{d.time}</p>
                      </Td>
                      <Td dir="ltr" className="whitespace-nowrap text-start">
                        {a.phone ?? '—'}
                      </Td>
                      <Td dir="ltr" className="max-w-48 truncate text-start">
                        {a.email ?? '—'}
                      </Td>
                      <Td>
                        <StatusChip color={ADMISSION_COLOR[a.status]}>
                          {ts(
                            a.status === 'UNDER_REVIEW'
                              ? 'PENDING'
                              : a.status === 'ACCEPTED'
                                ? 'APPROVED'
                                : 'REJECTED',
                          )}
                        </StatusChip>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          {a.status === 'UNDER_REVIEW' ? (
                            <>
                              {canAccept && (
                                <Button size="sm" onClick={() => setAccepting(a)}>
                                  <Check /> {t('accept')}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setRejecting(a)}
                              >
                                <X /> {t('reject')}
                              </Button>
                            </>
                          ) : a.childId ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/children/${a.childId}`}>{t('viewChild')}</Link>
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              total={list.data.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>
      <AcceptDialog a={accepting} onClose={() => setAccepting(null)} />
      <RejectDialog a={rejecting} onClose={() => setRejecting(null)} />
    </>
  );
}
