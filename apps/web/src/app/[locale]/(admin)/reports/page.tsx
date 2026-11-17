import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReportsView } from '@/components/reports/reports-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reports');
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/reports'>) {
  await initLocale(params);
  return <ReportsView />;
}
