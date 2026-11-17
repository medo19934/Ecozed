'use client';

import type { AuthUser, DashboardSummary } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Baby,
  BookOpen,
  ClipboardCheck,
  MonitorSmartphone,
  School,
  Shapes,
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
        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <AttendanceDonut scope={scope} />
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
