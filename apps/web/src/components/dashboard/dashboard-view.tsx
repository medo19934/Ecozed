'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/use-session';
import { ParentHome } from './parent-home';

export function DashboardView() {
  const t = useTranslations('dashboard');
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

  const branch = user.memberships.find((m) => m.daycareId === user.daycareId)?.daycareName;
  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      <div className="grid gap-6">
        <Card className="border-0 bg-brand-gradient text-white">
          <CardContent className="space-y-1">
            <h2 className="text-xl font-semibold">{t('welcome', { name: user.fullName })}</h2>
            <p className="text-white/85">
              {branch ? t('subtitle', { branch }) : t('subtitleNoBranch')}
            </p>
          </CardContent>
        </Card>
        <p className="rounded-[20px] border border-dashed p-6 text-sm text-muted-foreground">
          {t('placeholder')}
        </p>
      </div>
    </>
  );
}
