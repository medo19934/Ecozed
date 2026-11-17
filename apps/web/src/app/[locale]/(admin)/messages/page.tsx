import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MessagesView } from '@/components/messages/messages-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('messages');
  return { title: t('title') };
}

export default async function MessagesPage({ params }: PageProps<'/[locale]/messages'>) {
  await initLocale(params);
  return <MessagesView />;
}
