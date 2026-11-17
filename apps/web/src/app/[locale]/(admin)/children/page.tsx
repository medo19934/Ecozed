import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ChildrenView } from '@/components/children/children-view';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('children');
  return { title: t('title') };
}

export default async function ChildrenPage({ params }: PageProps<'/[locale]/children'>) {
  await initLocale(params);
  return (
    <Suspense>
      <ChildrenView />
    </Suspense>
  );
}
