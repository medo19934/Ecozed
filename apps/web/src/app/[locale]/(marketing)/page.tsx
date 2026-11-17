import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { initLocale } from '@/i18n/locale';

/** Placeholder landing page — the full marketing site is Phase 7. */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  await initLocale(params);
  const t = await getTranslations('marketing');
  const tc = await getTranslations('common');

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <BrandLogo name={tc('appName')} />
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Button variant="ghost" asChild>
            <Link href="/login">{t('ctaLogin')}</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-24 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          <span className="text-brand-gradient">{t('heroTitle')}</span>
        </h1>
        <p className="text-lg text-muted-foreground">{t('heroSubtitle')}</p>
        <div className="flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">
              {t('ctaRegister')}
              <ArrowRight className="rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
