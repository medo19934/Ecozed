import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DashboardWelcome } from '@/components/dashboard/welcome';
import { PageHeader } from '@/components/layout/page-header';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

export default async function DashboardPage({ params }: PageProps<'/[locale]/dashboard'>) {
  await initLocale(params);
  const t = await getTranslations('dashboard');
  const tn = await getTranslations('nav');

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('home'), href: '/' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      <div className="grid gap-6">
        <DashboardWelcome />
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {t('placeholder')}
        </p>
      </div>
    </>
  );
}
