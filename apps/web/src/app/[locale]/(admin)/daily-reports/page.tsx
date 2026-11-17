import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DailyReportsPage } from '@/components/daily-reports/daily-reports-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dailyReports');
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/daily-reports'>) {
  await initLocale(params);
  return <DailyReportsPage />;
}
