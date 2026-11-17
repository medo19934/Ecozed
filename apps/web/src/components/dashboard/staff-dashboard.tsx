'use client';

import type { AuthUser, DashboardSummary } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useErrorMessage } from '@/lib/use-error-message';
import {
  Baby,
  BookOpen,
  ClipboardCheck,
  MonitorSmartphone,
  School,
  Shapes,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { AttendanceDonut } from './attendance-donut';
import { LatestMessages, StatCard, UpcomingEvents } from './widgets';
import { useSar } from '@/components/subscriptions/subscriptions-view';
import { CreditCard, NotebookPen, UserCheck, UserPlus as UserPlusIcon } from 'lucide-react';

function Kpi({
  icon: Icon,
  label,
  value,
  href,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  href?: string;
  tint: string;
}) {
  const body = (
    <Card
      className={cn(
        'relative gap-3 overflow-hidden px-5 py-5 transition',
        href && 'hover:-translate-y-0.5 hover:shadow-lg',
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
          <Skeleton className="h-8 w-14" />
        ) : (
          <p className="text-3xl font-bold">{value}</p>
        )}
        <p className="text-sm text-muted-foreground">{label}</p>
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

export function StaffDashboard({ user }: { user: AuthUser }) {
  const t = useTranslations('dashboard');
  const [scope, setScope] = useState<'branch' | 'all'>('branch');
  const summary = useQuery({
    queryKey: ['dashboard', 'summary', scope, user.daycareId],
    queryFn: () => api.get<DashboardSummary>(`/dashboard/summary?scope=${scope}`),
  });
  const s = summary.data;
  const branch = user.memberships.find((m) => m.daycareId === user.daycareId)?.daycareName;
  const admin = user.role === 'SUPER_ADMIN' || user.role === 'MANAGER';
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const sample = useMutation({
    mutationFn: () => api.post('/test-data'),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success(t('sampleLoaded'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const empty = admin && scope === 'branch' && s !== undefined && s.children === 0;
  const sar = useSar();
  const extras = useQuery({
    queryKey: ['dashboard', 'extras', scope, user.daycareId],
    queryFn: () =>
      api.get<{
        unpaidCount: number;
        unpaidAmount: number;
        pendingAdmissions: number;
        reports: { shared: number; total: number };
        staff: { checkedIn: number; total: number };
      }>(`/dashboard/extras?scope=${scope}`),
    enabled: admin,
  });
  const x = extras.data;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={branch ? t('subtitle', { branch }) : undefined}
        crumbs={[{ label: t('title') }]}
        crumbsLabel={t('title')}
        actions={
          user.isSuperAdmin ? (
            <Select
              aria-label={t('branchScope')}
              value={scope}
              onChange={(e) => setScope(e.target.value as 'branch')}
              className="w-44"
            >
              <option value="branch">{t('currentBranch')}</option>
              <option value="all">{t('allBranches')}</option>
            </Select>
          ) : undefined
        }
      />
      <div className="grid gap-6">
        {empty && (
          <Card className="flex flex-col gap-4 border-dashed bg-brand-gradient/5 p-5 sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white">
              <Sparkles className="size-6" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{t('emptyTitle', { branch: branch ?? '' })}</p>
              <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/children">{t('emptyAddChild')}</Link>
              </Button>
              <Button onClick={() => sample.mutate()} disabled={sample.isPending}>
                <Sparkles /> {t('loadSample')}
              </Button>
            </div>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Kpi
            icon={Baby}
            label={t('cards.children')}
            value={s?.children}
            href="/children"
            tint="#5b6db4"
          />
          <Kpi
            icon={Users}
            label={t('cards.staff')}
            value={s?.staff}
            href={admin ? '/staff' : undefined}
            tint="#7b649b"
          />
          <Kpi
            icon={School}
            label={t('cards.classes')}
            value={s?.classes}
            href="/classes"
            tint="#2fb36d"
          />
          <Kpi
            icon={BookOpen}
            label={t('cards.units')}
            value={s?.units}
            href="/units"
            tint="#f2a33a"
          />
          <Kpi
            icon={Shapes}
            label={t('cards.activities')}
            value={s?.activities}
            href="/calendar"
            tint="#e5484d"
          />
        </div>
        {admin && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={CreditCard}
              label={t('unpaidSubs')}
              value={x?.unpaidCount}
              sub={x ? sar(x.unpaidAmount) : undefined}
              href="/subscriptions"
              tint="#e5484d"
            />
            <StatCard
              icon={UserPlusIcon}
              label={t('pendingAdmissions')}
              value={x?.pendingAdmissions}
              href="/admissions"
              tint="#f2a33a"
            />
            <StatCard
              icon={NotebookPen}
              label={t('reportsToday')}
              value={x ? `${x.reports.shared}/${x.reports.total}` : undefined}
              href="/daily-reports"
              tint="#5b6db4"
            />
            <StatCard
              icon={UserCheck}
              label={t('staffPresent')}
              value={x ? `${x.staff.checkedIn}/${x.staff.total}` : undefined}
              href="/attendance"
              tint="#2fb36d"
            />
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-6">
            <AttendanceDonut scope={scope} />
            <div className="grid gap-6 lg:grid-cols-2">
              <UpcomingEvents />
              <LatestMessages />
            </div>
          </div>
          <Card className="h-fit gap-3 p-5">
            <p className="font-semibold">{t('quickActions')}</p>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/attendance">
                <ClipboardCheck /> {t('takeAttendance')}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/kiosk">
                <MonitorSmartphone /> {t('openKiosk')}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/children">
                <Baby /> {t('addChild')}
              </Link>
            </Button>
            {admin && (
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/staff">
                  <UserPlus /> {t('addStaff')}
                </Link>
              </Button>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
