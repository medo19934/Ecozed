import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EnrollView } from '@/components/admissions/enroll-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('enroll');
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/enroll'>) {
  await initLocale(params);
  return <EnrollView />;
}
