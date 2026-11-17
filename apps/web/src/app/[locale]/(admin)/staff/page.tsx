import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StaffView } from '@/components/staff/staff-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('staff');
  return { title: t('title') };
}

export default async function StaffPage({ params }: PageProps<'/[locale]/staff'>) {
  await initLocale(params);
  return <StaffView />;
}
