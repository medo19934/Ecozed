import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ClassesView } from '@/components/classes/classes-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('classes');
  return { title: t('title') };
}

export default async function ClassesPage({ params }: PageProps<'/[locale]/classes'>) {
  await initLocale(params);
  return <ClassesView />;
}
