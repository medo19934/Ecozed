import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

export default async function DashboardPage({ params }: PageProps<'/[locale]/dashboard'>) {
  await initLocale(params);
  return <DashboardView />;
}
