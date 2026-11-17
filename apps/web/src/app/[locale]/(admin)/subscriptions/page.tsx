import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SubscriptionsPage } from '@/components/subscriptions/subscriptions-page';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('subscriptions');
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/subscriptions'>) {
  await initLocale(params);
  return <SubscriptionsPage />;
}
