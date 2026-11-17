import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UnitsView } from '@/components/units/units-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('units');
  return { title: t('title') };
}

export default async function UnitsPage({ params }: PageProps<'/[locale]/units'>) {
  await initLocale(params);
  return <UnitsView />;
}
