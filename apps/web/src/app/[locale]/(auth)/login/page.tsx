import { Baby, BriefcaseBusiness } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { DevLogin } from '@/components/auth/dev-login';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('title') };
}

export default async function LoginPage({ params }: PageProps<'/[locale]/login'>) {
  await initLocale(params);
  const t = await getTranslations('auth');
  const devLogin = process.env.NEXT_PUBLIC_AUTH_DEV_LOGIN === 'true';

  return (
    <div className="overflow-hidden rounded-[20px] bg-card shadow-soft">
      <div className="bg-brand-gradient px-6 py-8 text-white sm:px-8">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-white/85">{t('subtitle')}</p>
      </div>
      <div className="grid gap-6 p-6 sm:p-8">
        <Suspense>
          <GoogleSignIn />
        </Suspense>
        <ul className="grid gap-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <Baby className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t('parentsNote')}
          </li>
          <li className="flex items-start gap-3">
            <BriefcaseBusiness className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t('staffNote')}
          </li>
        </ul>
        {devLogin && (
          <Suspense>
            <DevLogin />
          </Suspense>
        )}
      </div>
    </div>
  );
}
