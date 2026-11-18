import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AssistantView } from '@/components/assistant/assistant-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('assistant');
  return { title: t('title') };
}

export default async function AssistantPage({ params }: PageProps<'/[locale]/assistant'>) {
  await initLocale(params);
  return <AssistantView />;
}
