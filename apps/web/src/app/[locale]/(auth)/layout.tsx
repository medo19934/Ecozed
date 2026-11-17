import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { initLocale } from '@/i18n/locale';

export default async function AuthLayout({ children, params }: LayoutProps<'/[locale]'>) {
  await initLocale(params);
  const t = await getTranslations('common');
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <BrandLogo name={t('appName')} />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
