'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/use-session';
import { ParentHome } from './parent-home';
import { StaffDashboard } from './staff-dashboard';
import { TeacherDashboard } from './teacher-dashboard';

export function DashboardView() {
  const tn = useTranslations('nav');
  const { data: user } = useSession();

  if (!user) return <Skeleton className="h-40 w-full" />;
  if (user.role === 'PARENT') {
    return (
      <>
        <PageHeader
          title={tn('home')}
          crumbs={[{ label: tn('home') }]}
          crumbsLabel={tn('breadcrumb')}
        />
        <ParentHome user={user} />
      </>
    );
  }

  if (user.role === 'STAFF') return <TeacherDashboard user={user} />;
  return <StaffDashboard user={user} />;
}
