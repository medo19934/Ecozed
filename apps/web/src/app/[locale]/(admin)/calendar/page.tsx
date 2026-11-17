import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CalendarView } from '@/components/calendar/calendar-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('calendar');
  return { title: t('title') };
}

export default async function CalendarPage({ params }: PageProps<'/[locale]/calendar'>) {
  await initLocale(params);
  return <CalendarView />;
}
