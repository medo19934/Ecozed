import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { StaffProfile } from '@/components/staff/staff-profile';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('staff');
  return { title: t('title') };
}

export default async function StaffProfilePage({ params }: PageProps<'/[locale]/staff/[id]'>) {
  await initLocale(params);
  const { id } = await params;
  return <StaffProfile id={id} />;
}
