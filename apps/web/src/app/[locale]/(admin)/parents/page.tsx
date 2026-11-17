import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ParentsView } from '@/components/parents/parents-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parents');
  return { title: t('title') };
}

export default async function ParentsPage({ params }: PageProps<'/[locale]/parents'>) {
  await initLocale(params);
  return <ParentsView />;
}
