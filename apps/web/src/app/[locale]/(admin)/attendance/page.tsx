import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AttendanceView } from '@/components/attendance/attendance-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('attendance');
  return { title: t('title') };
}

export default async function AttendancePage({ params }: PageProps<'/[locale]/attendance'>) {
  await initLocale(params);
  return <AttendanceView />;
}
