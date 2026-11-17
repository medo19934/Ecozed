import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { KioskView } from '@/components/attendance/kiosk-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('kiosk');
  return { title: t('title') };
}

export default async function KioskPage({ params }: PageProps<'/[locale]/kiosk'>) {
  await initLocale(params);
  return <KioskView />;
}
