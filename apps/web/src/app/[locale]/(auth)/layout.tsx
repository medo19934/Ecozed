import { CalendarCheck, MessageCircleHeart, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';
import { initLocale } from '@/i18n/locale';

export default async function AuthLayout({ children, params }: LayoutProps<'/[locale]'>) {
  await initLocale(params);
  const t = await getTranslations('common');
  const tm = await getTranslations('marketing');
  const tn = await getTranslations('nav');

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label={t('appName')}>
            <BrandLogo name={t('appName')} />
          </Link>
          <LocaleSwitcher />
        </header>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div
          className="absolute -end-24 -top-24 size-96 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -start-16 size-80 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-snug">{tm('heroTitle')}</h2>
          <p className="text-white/80">{tm('heroSubtitle')}</p>
          <ul className="grid gap-3 text-sm">
            {[
              { icon: CalendarCheck, label: tn('attendance') },
              { icon: MessageCircleHeart, label: tn('messages') },
              { icon: ShieldCheck, label: tn('subscriptions') },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
