'use client';

import {
  CreateSubscriptionSchema,
  PlanSchema,
  localDate,
  type ChildListItem,
  type Paginated,
  type PlanDto,
  type SubscriptionDto,
  type SubscriptionListResponse,
} from '@latif/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Ban,
  BellRing,
  CircleCheck,
  CircleDollarSign,
  CreditCard,
  EllipsisVertical,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { TagInput } from '@/components/ui/tag-input';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { useClasses } from '@/lib/queries';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { cn } from '@/lib/utils';

type Period = 'all' | 'today' | 'week' | 'month' | 'year';
const PAY_COLOR = { PAID: 'green', UNPAID: 'red' } as const;
const STATUS_COLOR = { ACTIVE: 'green', ENDED: 'gray', CANCELED: 'red' } as const;

export function useSar() {
  const locale = useLocale();
  return (n: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 2,
    }).format(n);
}

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

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const PERIOD_DAYS = { MONTHLY: 30, TERM: 120, YEARLY: 365 } as const;

function SubscriptionDialog({ plans, children }: { plans: PlanDto[]; children: ReactNode }) {
  const t = useTranslations('subscriptions');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const [open, setOpen] = useState(false);
  const today = localDate();
  const blank = {
    childId: '',
    planId: '',
    value: '',
    startDate: today,
    endDate: addDays(today, 29),
    paymentStatus: 'UNPAID',
    paymentMethod: 'CASH',
  };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (open) setF(blank);
  }, [open]); // reset on open
  const kids = useQuery({
    queryKey: ['children', 'pick', 'all'],
    queryFn: () => api.get<Paginated<ChildListItem>>('/children?pageSize=100&status=ACTIVE'),
    enabled: open,
  });
  const save = useMutation({
    mutationFn: (body: unknown) => api.post<SubscriptionDto>('/subscriptions', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(tc('saved'));
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pickPlan = (id: string) => {
    const p = plans.find((x) => x.id === id);
    setF((s) => ({
      ...s,
      planId: id,
      value: p ? String(p.price) : s.value,
      endDate: p ? addDays(s.startDate, PERIOD_DAYS[p.period] - 1) : s.endDate,
    }));
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t('add')} closeLabel={tc('close')}>
        <form
          id="sub-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = validate(CreateSubscriptionSchema, {
              ...f,
              planId: f.planId || null,
              value: f.value === '' ? undefined : Number(f.value),
              paymentMethod: f.paymentStatus === 'PAID' ? f.paymentMethod : null,
            });
            if (body) save.mutate(body);
          }}
        >
          <FormField
            id="sub-child"
            label={t('child')}
            error={errors.childId}
            className="sm:col-span-2"
          >
            <Select
              id="sub-child"
              value={f.childId}
              onChange={(e) => setF({ ...f, childId: e.target.value })}
            >
              <option value="">{t('choose')}</option>
              {kids.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                  {c.classroom ? ` — ${c.classroom.name}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="sub-plan" label={t('plan')}>
            <Select id="sub-plan" value={f.planId} onChange={(e) => pickPlan(e.target.value)}>
              <option value="">{t('noPlan')}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="sub-value" label={t('value')} error={errors.value}>
            <Input
              id="sub-value"
              type="number"
              min={0}
              step="0.01"
              dir="ltr"
              value={f.value}
              onChange={(e) => setF({ ...f, value: e.target.value })}
            />
          </FormField>
          <FormField id="sub-start" label={t('start')} error={errors.startDate}>
            <Input
              id="sub-start"
              type="date"
              value={f.startDate}
              onChange={(e) => setF({ ...f, startDate: e.target.value })}
            />
          </FormField>
          <FormField id="sub-end" label={t('end')} error={errors.endDate}>
            <Input
              id="sub-end"
              type="date"
              value={f.endDate}
              onChange={(e) => setF({ ...f, endDate: e.target.value })}
            />
          </FormField>
          <FormField id="sub-pay" label={t('paymentStatus')}>
            <Select
              id="sub-pay"
              value={f.paymentStatus}
              onChange={(e) => setF({ ...f, paymentStatus: e.target.value })}
            >
              <option value="UNPAID">{t('pay.UNPAID')}</option>
              <option value="PAID">{t('pay.PAID')}</option>
            </Select>
          </FormField>
          {f.paymentStatus === 'PAID' && (
            <FormField id="sub-method" label={t('paymentMethod')}>
              <Select
                id="sub-method"
                value={f.paymentMethod}
                onChange={(e) => setF({ ...f, paymentMethod: e.target.value })}
              >
                {(['CASH', 'CARD', 'TRANSFER'] as const).map((m) => (
                  <option key={m} value={m}>
                    {t(`method.${m}`)}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </form>
        <DialogFooter>
          <Button type="submit" form="sub-form" disabled={save.isPending}>
            {tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ plan, children }: { plan?: PlanDto; children: ReactNode }) {
  const t = useTranslations('subscriptions');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', price: '', period: 'MONTHLY', services: [] as string[] });
  useEffect(() => {
    if (open)
      setF(
        plan
          ? {
              name: plan.name,
              price: String(plan.price),
              period: plan.period,
              services: plan.services,
            }
          : { name: '', price: '', period: 'MONTHLY', services: [] },
      );
  }, [open, plan]);
  const save = useMutation({
    mutationFn: (body: unknown) =>
      plan
        ? api.put<PlanDto>(`/subscriptions/plans/${plan.id}`, body)
        : api.post<PlanDto>('/subscriptions/plans', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(tc('saved'));
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={plan ? t('editPlan') : t('addPlan')} closeLabel={tc('close')}>
        <form
          id="plan-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const body = validate(PlanSchema, {
              ...f,
              price: f.price === '' ? undefined : Number(f.price),
            });
            if (body) save.mutate(body);
          }}
        >
          <FormField id="pl-name" label={t('planName')} error={errors.name}>
            <Input
              id="pl-name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pl-price" label={t('price')} error={errors.price}>
              <Input
                id="pl-price"
                type="number"
                min={0}
                dir="ltr"
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </FormField>
            <FormField id="pl-period" label={t('period')}>
              <Select
                id="pl-period"
                value={f.period}
                onChange={(e) => setF({ ...f, period: e.target.value })}
              >
                {(['MONTHLY', 'TERM', 'YEARLY'] as const).map((p) => (
                  <option key={p} value={p}>
                    {t(`periods.${p}`)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField id="pl-services" label={t('services')} hint={t('servicesHint')}>
            <TagInput
              id="pl-services"
              value={f.services}
              removeLabel={tc('delete')}
              onChange={(services) => setF({ ...f, services })}
            />
          </FormField>
        </form>
        <DialogFooter>
          <Button type="submit" form="plan-form" disabled={save.isPending}>
            {tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaidDialog({ sub, onClose }: { sub: SubscriptionDto | null; onClose: () => void }) {
  const t = useTranslations('subscriptions');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const pay = useMutation({
    mutationFn: () => api.post(`/subscriptions/${sub!.id}/paid`, { paymentMethod: method }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(t('markedPaid'));
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!sub} onOpenChange={(o) => !o && onClose()}>
      {sub && (
        <DialogContent
          title={t('markPaid')}
          description={sub.child.fullName}
          closeLabel={tc('close')}
        >
          <div className="grid gap-2">
            {(['CASH', 'CARD', 'TRANSFER'] as const).map((m) => (
              <label
                key={m}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3',
                  method === m && 'border-primary bg-secondary',
                )}
              >
                <input
                  type="radio"
                  name="method"
                  checked={method === m}
                  onChange={() => setMethod(m)}
                  className="accent-primary"
                />
                {t(`method.${m}`)}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
              <CircleCheck /> {t('markPaid')}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function SubscriptionsView() {
  const t = useTranslations('subscriptions');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const qc = useQueryClient();
  const fmt = useFormatDate();
  const sar = useSar();
  const errorMessage = useErrorMessage();
  const canArchive = useCan('canArchiveAccounts');
  const classes = useClasses();
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search);
  const [filters, setFilters] = useState({
    classroomId: '',
    accountStatus: '',
    planId: '',
    paymentStatus: '',
    status: '',
  });
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<SubscriptionDto | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (q) params.set('search', q);
  if (period !== 'all') params.set('period', period);
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const list = useQuery({
    queryKey: ['subscriptions', 'list', params.toString()],
    queryFn: () => api.get<SubscriptionListResponse>(`/subscriptions?${params}`),
    placeholderData: keepPreviousData,
  });
  const plans = useQuery({
    queryKey: ['subscriptions', 'plans'],
    queryFn: () => api.get<PlanDto[]>('/subscriptions/plans'),
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'remind' | 'cancel' | 'archive-child' }) =>
      api.post(`/subscriptions/${id}/${action}`),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(t(`done.${v.action}`));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delPlan = useMutation({
    mutationFn: (id: string) => api.delete(`/subscriptions/plans/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscriptions'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: keyof typeof filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const s = list.data?.summary;
  const rows = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
        actions={
          <SubscriptionDialog plans={plans.data ?? []}>
            <Button>
              <Plus /> {t('add')}
            </Button>
          </SubscriptionDialog>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="grid min-w-0 gap-5">
          <div className="flex flex-wrap gap-2">
            {(['all', 'today', 'week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPeriod(p);
                  setPage(1);
                }}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm',
                  period === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                )}
              >
                {t(`periodsFilter.${p}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              icon={Users}
              label={t('cards.total')}
              value={s?.total}
              tint="#5b6db4"
              active={!filters.paymentStatus && !filters.status}
              onClick={() => setFilters((f) => ({ ...f, paymentStatus: '', status: '' }))}
            />
            <Kpi
              icon={CircleCheck}
              label={t('cards.paid')}
              value={s?.paid}
              tint="#2fb36d"
              active={filters.paymentStatus === 'PAID'}
              onClick={() => setFilters((f) => ({ ...f, paymentStatus: 'PAID', status: '' }))}
            />
            <Kpi
              icon={CircleDollarSign}
              label={t('cards.unpaid')}
              value={s?.unpaid}
              tint="#e5484d"
              active={filters.paymentStatus === 'UNPAID'}
              onClick={() => setFilters((f) => ({ ...f, paymentStatus: 'UNPAID', status: '' }))}
            />
            <Kpi
              icon={Ban}
              label={t('cards.canceled')}
              value={s?.canceled}
              tint="#8a8aa3"
              active={filters.status === 'CANCELED'}
              onClick={() => setFilters((f) => ({ ...f, status: 'CANCELED', paymentStatus: '' }))}
            />
          </div>
          <Card className="grid gap-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="ps-9"
                  placeholder={t('search')}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                aria-label={t('filters.class')}
                value={filters.classroomId}
                onChange={(e) => set('classroomId', e.target.value)}
              >
                <option value="">
                  {t('filters.class')}: {t('all')}
                </option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t('filters.account')}
                value={filters.accountStatus}
                onChange={(e) => set('accountStatus', e.target.value)}
              >
                <option value="">
                  {t('filters.account')}: {t('all')}
                </option>
                <option value="ACTIVE">{tc('active')}</option>
                <option value="ARCHIVED">{tc('archived')}</option>
              </Select>
              <Select
                aria-label={t('filters.plan')}
                value={filters.planId}
                onChange={(e) => set('planId', e.target.value)}
              >
                <option value="">
                  {t('filters.plan')}: {t('all')}
                </option>
                {(plans.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t('filters.payment')}
                value={filters.paymentStatus}
                onChange={(e) => set('paymentStatus', e.target.value)}
              >
                <option value="">
                  {t('filters.payment')}: {t('all')}
                </option>
                <option value="PAID">{t('pay.PAID')}</option>
                <option value="UNPAID">{t('pay.UNPAID')}</option>
              </Select>
              <Select
                aria-label={t('filters.status')}
                value={filters.status}
                onChange={(e) => set('status', e.target.value)}
              >
                <option value="">
                  {t('filters.status')}: {t('all')}
                </option>
                {(['ACTIVE', 'ENDED', 'CANCELED'] as const).map((x) => (
                  <option key={x} value={x}>
                    {t(`status.${x}`)}
                  </option>
                ))}
              </Select>
            </div>
            {list.isPending ? (
              <Skeleton className="h-64" />
            ) : rows.length === 0 ? (
              <EmptyState icon={CreditCard} title={t('empty')} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>{t('child')}</Th>
                      <Th>{t('start')}</Th>
                      <Th>{t('end')}</Th>
                      <Th>{t('plan')}</Th>
                      <Th>{t('value')}</Th>
                      <Th>{t('paymentStatus')}</Th>
                      <Th>{t('paymentMethod')}</Th>
                      <Th>{t('statusCol')}</Th>
                      <Th />
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.map((r) => {
                      const unpaid = r.paymentStatus === 'UNPAID' && r.status !== 'CANCELED';
                      return (
                        <Tr
                          key={r.id}
                          className={cn(
                            unpaid && 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/30',
                          )}
                        >
                          <Td>
                            <p className="font-medium">{r.child.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.child.classroom ?? '—'}
                              {r.child.status === 'ARCHIVED' && ` · ${tc('archived')}`}
                            </p>
                          </Td>
                          <Td className="whitespace-nowrap">{fmt(r.startDate)}</Td>
                          <Td className="whitespace-nowrap">{fmt(r.endDate)}</Td>
                          <Td>{r.plan?.name ?? '—'}</Td>
                          <Td className="whitespace-nowrap font-medium">{sar(r.value)}</Td>
                          <Td>
                            <StatusChip
                              color={r.status === 'CANCELED' ? 'gray' : PAY_COLOR[r.paymentStatus]}
                            >
                              {t(`pay.${r.paymentStatus}`)}
                            </StatusChip>
                          </Td>
                          <Td>{r.paymentMethod ? t(`method.${r.paymentMethod}`) : '—'}</Td>
                          <Td>
                            <StatusChip color={STATUS_COLOR[r.status]}>
                              {t(`status.${r.status}`)}
                            </StatusChip>
                          </Td>
                          <Td className="text-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={t('actions')}>
                                  <EllipsisVertical />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled={!unpaid} onSelect={() => setPaying(r)}>
                                  <CircleCheck className="text-success" /> {t('markPaid')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!unpaid}
                                  onSelect={() => act.mutate({ id: r.id, action: 'remind' })}
                                >
                                  <BellRing /> {t('remind')}
                                </DropdownMenuItem>
                                {canArchive && (
                                  <DropdownMenuItem
                                    disabled={r.child.status === 'ARCHIVED'}
                                    onSelect={() =>
                                      act.mutate({ id: r.id, action: 'archive-child' })
                                    }
                                  >
                                    <Archive /> {t('archiveChild')}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={r.status === 'CANCELED'}
                                  onSelect={() => act.mutate({ id: r.id, action: 'cancel' })}
                                >
                                  <Ban /> {t('cancel')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
            {list.data && list.data.totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={list.data.totalPages}
                total={list.data.total}
                onPage={setPage}
              />
            )}
          </Card>
        </div>

        <aside className="grid h-fit gap-4">
          <Card className="grid gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Layers className="size-4 text-primary" /> {t('plans')}
              </h2>
              <PlanDialog>
                <Button size="sm" variant="outline">
                  <Plus /> {t('addPlan')}
                </Button>
              </PlanDialog>
            </div>
            {(plans.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noPlans')}</p>
            )}
            {(plans.data ?? []).map((p) => (
              <div key={p.id} className="rounded-2xl border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {sar(p.price)} · {t(`periods.${p.period}`)} ·{' '}
                      {t('activeCount', { n: p.activeCount })}
                    </p>
                  </div>
                  <PlanDialog plan={p}>
                    <Button variant="ghost" size="icon" aria-label={tc('edit')}>
                      <Pencil />
                    </Button>
                  </PlanDialog>
                  <Confirm
                    title={t('deletePlan')}
                    body={p.name}
                    confirmLabel={tc('delete')}
                    destructive
                    onConfirm={() => delPlan.mutate(p.id)}
                  >
                    <Button variant="ghost" size="icon" aria-label={tc('delete')}>
                      <Trash2 />
                    </Button>
                  </Confirm>
                </div>
                {p.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.services.map((x) => (
                      <StatusChip key={x} color="blue">
                        {x}
                      </StatusChip>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>
          <Card className="grid gap-3 p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <BellRing className="size-4 text-primary" /> {t('reminders')}
            </h2>
            {s && s.unpaidAmount > 0 && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-destructive dark:bg-red-950/30">
                {t('unpaidTotal', { amount: sar(s.unpaidAmount) })}
              </p>
            )}
            {(list.data?.reminders ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noReminders')}</p>
            ) : (
              list.data!.reminders.map((r) => (
                <div
                  key={r.subscriptionId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{r.childName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmt(r.at)} · ×{r.count}
                  </span>
                </div>
              ))
            )}
          </Card>
        </aside>
      </div>
      <PaidDialog sub={paying} onClose={() => setPaying(null)} />
    </>
  );
}

/** Parent: read-only subscription status of own children. */
export function MySubscriptions() {
  const t = useTranslations('subscriptions');
  const tn = useTranslations('nav');
  const fmt = useFormatDate();
  const sar = useSar();
  const q = useQuery({
    queryKey: ['subscriptions', 'mine'],
    queryFn: () => api.get<SubscriptionDto[]>('/subscriptions/mine'),
  });
  return (
    <>
      <PageHeader
        title={t('mineTitle')}
        crumbs={[{ label: tn('home'), href: '/dashboard' }, { label: t('mineTitle') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      {q.isPending ? (
        <Skeleton className="h-48" />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={CreditCard} title={t('mineEmpty')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data!.map((r) => (
            <Card
              key={r.id}
              className={cn(
                'grid gap-3 p-5',
                r.paymentStatus === 'UNPAID' && r.status !== 'CANCELED' && 'border-destructive/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.child.fullName}</p>
                  <p className="text-sm text-muted-foreground">{r.plan?.name ?? '—'}</p>
                </div>
                <StatusChip color={r.status === 'CANCELED' ? 'gray' : PAY_COLOR[r.paymentStatus]}>
                  {t(`pay.${r.paymentStatus}`)}
                </StatusChip>
              </div>
              <p className="text-2xl font-bold">{sar(r.value)}</p>
              <p className="text-sm text-muted-foreground">
                {fmt(r.startDate)} – {fmt(r.endDate)} · {t(`status.${r.status}`)}
              </p>
              {r.paymentStatus === 'UNPAID' && r.status !== 'CANCELED' && (
                <p className="text-sm text-destructive">{t('payOnSite')}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
