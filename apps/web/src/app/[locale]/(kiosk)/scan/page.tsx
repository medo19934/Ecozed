import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ScanView } from '@/components/attendance/scan-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('kiosk');
  return { title: t('title') };
}

export default async function ScanPage({ params }: PageProps<'/[locale]/scan'>) {
  await initLocale(params);
  return (
    <Suspense>
      <ScanView />
    </Suspense>
  );
}
