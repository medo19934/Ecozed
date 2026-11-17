import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ChildProfile } from '@/components/children/child-profile';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('children');
  return { title: t('profile') };
}

export default async function ChildProfilePage({ params }: PageProps<'/[locale]/children/[id]'>) {
  await initLocale(params);
  const { id } = await params;
  return <ChildProfile id={id} />;
}
