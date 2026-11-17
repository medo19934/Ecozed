import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SettingsView } from '@/components/settings/settings-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage({ params }: PageProps<'/[locale]/settings'>) {
  await initLocale(params);
  return <SettingsView />;
}
