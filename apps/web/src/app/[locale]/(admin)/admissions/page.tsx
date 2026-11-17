import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdmissionsView } from '@/components/admissions/admissions-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admissions');
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/admissions'>) {
  await initLocale(params);
  return <AdmissionsView />;
}
