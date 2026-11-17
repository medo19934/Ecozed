'use client';

import {
  localDate,
  type DayStatus,
  type RosterResponse,
  type RosterRow,
  type StaffDayRow,
  type VacationDto,
} from '@latif/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleSlash,
  Eraser,
  LogIn,
  LogOut,
  MapPin,
  MonitorSmartphone,
  Search,
  Umbrella,
  X,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { ChildAvatar } from '@/components/children/child-avatar';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { useClasses } from '@/lib/queries';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { DayStatusChip } from './status-chip';

const ORDER: DayStatus[] = ['ATTENDED', 'DEPARTURE', 'ABSENT', 'VACATION', 'NO_RECORD'];

function useTime() {
  const f = useFormatter();
  return (iso: string | null) => (iso ? f.dateTime(new Date(iso), { timeStyle: 'short' }) : '—');
}

function ChildrenRoster() {
  const t = useTranslations('attendance');
  const tc = useTranslations('common');
  const tk = useTranslations('children');
  const ts = useTranslations('status');
  const td = useTranslations('dashboard');
  const qc = useQueryClient();
  const time = useTime();
  const errorMessage = useErrorMessage();
  const canManage = useCan('canManageAttendance');
  const classes = useClasses();
  const [date, setDate] = useState(() => localDate());
  const [classroomId, setClassroomId] = useState('');
  const [statusFilter, setStatusFilter] = useState<DayStatus | ''>('');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search);
  const params = new URLSearchParams({
    date,
    ...(classroomId ? { classroomId } : {}),
    ...(q ? { search: q } : {}),
  });
  const key = ['attendance', 'roster', params.toString()];
  const roster = useQuery({
    queryKey: key,
    queryFn: () => api.get<RosterResponse>(`/attendance/children?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const act = useMutation({
    mutationFn: ({ childId, action }: { childId: string; action: string }) =>
      api.post<RosterRow>(`/attendance/children/${childId}`, { action, date }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance', 'roster'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const today = localDate();
  const rows = (roster.data?.rows ?? []).filter((r) => !statusFilter || r.status === statusFilter);

  const action = (
    r: RosterRow,
    a: string,
    Icon: typeof LogIn,
    label: string,
    variant: 'default' | 'outline' | 'ghost' = 'outline',
  ) => (
    <Tooltip content={label}>
      <Button
        size="icon-sm"
        variant={variant}
        aria-label={`${label} — ${r.child.fullName}`}
        disabled={act.isPending}
        onClick={() => act.mutate({ childId: r.child.id, action: a })}
      >
        <Icon />
      </Button>
    </Tooltip>
  );

  return (
    <Card className="gap-0 py-0">
      <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_170px_170px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={tc('search')}
            placeholder={tc('search')}
            className="ps-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label={td('class')}
          value={classroomId}
          onChange={(e) => setClassroomId(e.target.value)}
        >
          <option value="">{td('allClasses')}</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label={tc('status')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DayStatus)}
        >
          <option value="">
            {tc('status')}: {tc('all')}
          </option>
          {ORDER.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </Select>
        <Input
          aria-label={t('date')}
          type="date"
          max={today}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </div>
      {roster.data && (
        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className="rounded-full ring-primary aria-pressed:ring-2"
            >
              <DayStatusChipCount status={s} n={roster.data.counts[s]} />
            </button>
          ))}
        </div>
      )}
      {!canManage && (
        <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {t('readOnly')}
        </p>
      )}
      {roster.isLoading ? (
        <div className="grid gap-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : roster.isError ? (
        <EmptyState icon={CircleSlash} title={errorMessage(roster.error)} />
      ) : !rows.length ? (
        <EmptyState icon={CircleSlash} title={tc('noResults')} />
      ) : (
        <Table>
          <THead>
            <Tr className="hover:bg-transparent">
              <Th>{tk('fullName')}</Th>
              <Th>{tk('class')}</Th>
              <Th>{tc('status')}</Th>
              <Th>{t('in')}</Th>
              <Th>{t('out')}</Th>
              {canManage && <Th className="text-end">{tc('actions')}</Th>}
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.child.id}>
                <Td>
                  <Link
                    href={`/children/${r.child.id}`}
                    className="flex items-center gap-3 font-medium hover:text-primary"
                  >
                    <ChildAvatar
                      src={r.child.hasPhoto ? `/children/${r.child.id}/photo` : null}
                      name={r.child.fullName}
                      gender={r.child.gender}
                      className="size-9"
                    />
                    {r.child.fullName}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">
                  {r.child.classroom?.name ?? tk('noClass')}
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <DayStatusChip status={r.status} />
                    {r.method && r.method !== 'MANUAL' && (
                      <StatusChip color="gray">{t(`method.${r.method}`)}</StatusChip>
                    )}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">
                  {time(r.checkInAt)}
                  {r.droppedOffBy && (
                    <span className="block text-xs text-muted-foreground">
                      {t('by')}: {r.droppedOffBy}
                    </span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {time(r.checkOutAt)}
                  {r.pickedUpBy && (
                    <span className="block text-xs text-muted-foreground">
                      {t('by')}: {r.pickedUpBy}
                    </span>
                  )}
                </Td>
                {canManage && (
                  <Td>
                    <div className="flex justify-end gap-1">
                      {r.status !== 'ATTENDED' &&
                        r.status !== 'DEPARTURE' &&
                        action(r, 'CHECK_IN', LogIn, t('checkIn'), 'default')}
                      {r.status === 'ATTENDED' &&
                        action(r, 'CHECK_OUT', LogOut, t('checkOut'), 'default')}
                      {r.status !== 'ABSENT' &&
                        r.status !== 'DEPARTURE' &&
                        action(r, 'ABSENT', X, t('absent'))}
                      {r.status !== 'NO_RECORD' &&
                        r.status !== 'VACATION' &&
                        action(r, 'CLEAR', Eraser, t('clear'), 'ghost')}
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function DayStatusChipCount({ status, n }: { status: DayStatus; n: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <DayStatusChip status={status} />
      <span className="text-sm font-semibold">{n}</span>
    </span>
  );
}

function StaffDay() {
  const t = useTranslations('attendance');
  const tc = useTranslations('common');
  const tst = useTranslations('staff');
  const time = useTime();
  const errorMessage = useErrorMessage();
  const [date, setDate] = useState(() => localDate());
  const q = useQuery({
    queryKey: ['attendance', 'staff', date],
    queryFn: () => api.get<{ date: string; rows: StaffDayRow[] }>(`/attendance/staff?date=${date}`),
    refetchInterval: 30_000,
  });
  return (
    <Card className="gap-0 py-0">
      <div className="flex justify-end border-b p-4">
        <Input
          aria-label={t('date')}
          type="date"
          max={localDate()}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-44"
        />
      </div>
      {q.isLoading ? (
        <div className="grid gap-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : q.isError ? (
        <EmptyState icon={CircleSlash} title={errorMessage(q.error)} />
      ) : !q.data?.rows.length ? (
        <EmptyState icon={CircleSlash} title={t('noStaff')} />
      ) : (
        <Table>
          <THead>
            <Tr className="hover:bg-transparent">
              <Th>{tst('fullName')}</Th>
              <Th>{tc('status')}</Th>
              <Th>{t('in')}</Th>
              <Th>{t('out')}</Th>
            </Tr>
          </THead>
          <TBody>
            {q.data.rows.map((s) => (
              <Tr key={s.membershipId}>
                <Td>
                  <Link
                    href={`/staff/${s.membershipId}`}
                    className="flex items-center gap-3 font-medium hover:text-primary"
                  >
                    <Avatar name={s.fullName} src={s.avatarUrl} />
                    {s.fullName}
                  </Link>
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.checkInAt ? (
                      <StatusChip color={s.checkOutAt ? 'blue' : 'green'}>
                        {s.checkOutAt ? t('out') : t('in')}
                      </StatusChip>
                    ) : (
                      <StatusChip color="gray">{t('notYet')}</StatusChip>
                    )}
                    {s.method && (
                      <StatusChip color="gray">
                        {s.method === 'GEO' && <MapPin className="size-3" aria-hidden />}{' '}
                        {t(`method.${s.method}`)}
                      </StatusChip>
                    )}
                    {s.distanceM != null && (
                      <span className="text-xs text-muted-foreground">
                        {t('distance', { m: s.distanceM })}
                      </span>
                    )}
                  </div>
                </Td>
                <Td>{time(s.checkInAt)}</Td>
                <Td>{time(s.checkOutAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function Vacations() {
  const t = useTranslations('attendance');
  const ts = useTranslations('status');
  const tc = useTranslations('common');
  const tk = useTranslations('children');
  const qc = useQueryClient();
  const fmt = useFormatDate();
  const errorMessage = useErrorMessage();
  const canManage = useCan('canManageAttendance');
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
  const q = useQuery({
    queryKey: ['attendance', 'vacations', status],
    queryFn: () =>
      api.get<VacationDto[]>(`/attendance/vacations${status ? `?status=${status}` : ''}`),
  });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      api.post<VacationDto>(`/attendance/vacations/${id}/review`, { decision }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const color = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red' } as const;
  return (
    <Card className="gap-0 py-0">
      <div className="flex justify-end border-b p-4">
        <Select
          aria-label={t('statusFilter')}
          value={status}
          onChange={(e) => setStatus(e.target.value as 'PENDING')}
          className="w-48"
        >
          <option value="">{tc('all')}</option>
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </Select>
      </div>
      {q.isLoading ? (
        <div className="grid gap-2 p-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <EmptyState icon={Umbrella} title={t('noVacations')} />
      ) : (
        <Table>
          <THead>
            <Tr className="hover:bg-transparent">
              <Th>{tk('fullName')}</Th>
              <Th>{t('from')}</Th>
              <Th>{t('to')}</Th>
              <Th>{t('reason')}</Th>
              <Th>{t('requestedBy')}</Th>
              <Th>{tc('status')}</Th>
              {canManage && <Th className="text-end">{tc('actions')}</Th>}
            </Tr>
          </THead>
          <TBody>
            {q.data.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <p className="font-medium">{v.child.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.child.classroom ?? tk('noClass')}
                  </p>
                </Td>
                <Td className="whitespace-nowrap">{fmt(v.startDate)}</Td>
                <Td className="whitespace-nowrap">{fmt(v.endDate)}</Td>
                <Td className="max-w-56 text-muted-foreground">{v.reason ?? '—'}</Td>
                <Td>{v.requestedBy}</Td>
                <Td>
                  <StatusChip color={color[v.status]}>{ts(v.status)}</StatusChip>
                </Td>
                {canManage && (
                  <Td>
                    {v.status === 'PENDING' && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: v.id, decision: 'APPROVED' })}
                        >
                          <Check /> {t('approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: v.id, decision: 'REJECTED' })}
                        >
                          <X /> {t('reject')}
                        </Button>
                      </div>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

export function AttendanceView() {
  const t = useTranslations('attendance');
  const tn = useTranslations('nav');
  const canManage = useCan('canManageAttendance');
  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
        actions={
          canManage && (
            <Button asChild>
              <Link href="/kiosk">
                <MonitorSmartphone /> {t('openKiosk')}
              </Link>
            </Button>
          )
        }
      />
      <Tabs defaultValue="children" className="grid gap-5">
        <TabsList className="justify-self-start">
          <TabsTrigger value="children">{t('childrenTab')}</TabsTrigger>
          {canManage && <TabsTrigger value="staff">{t('staffTab')}</TabsTrigger>}
          <TabsTrigger value="vacations">{t('vacationsTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="children">
          <ChildrenRoster />
        </TabsContent>
        {canManage && (
          <TabsContent value="staff">
            <StaffDay />
          </TabsContent>
        )}
        <TabsContent value="vacations">
          <Vacations />
        </TabsContent>
      </Tabs>
    </>
  );
}
