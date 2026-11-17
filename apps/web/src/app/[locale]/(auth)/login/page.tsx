import type { DemoAccount } from '@latif/shared';
import { Baby, BriefcaseBusiness } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { DevLogin } from '@/components/auth/dev-login';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { PasswordLogin } from '@/components/auth/password-login';
import { QuickLogin } from '@/components/auth/quick-login';
import { initLocale } from '@/i18n/locale';
import { callApi } from '@/lib/bff';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('title') };
}

async function loadOptions(): Promise<{
  publicDemo: boolean;
  google: boolean;
  accounts: DemoAccount[];
}> {
  try {
    const o = await callApi('/auth/options');
    const { publicDemo, google } = (await o.json()) as { publicDemo: boolean; google: boolean };
    if (!publicDemo) return { publicDemo: false, google, accounts: [] };
    const a = await callApi('/auth/demo-accounts');
    return { publicDemo, google, accounts: a.ok ? ((await a.json()) as DemoAccount[]) : [] };
  } catch {
    return { publicDemo: false, google: false, accounts: [] };
  }
}

export default async function LoginPage({ params }: PageProps<'/[locale]/login'>) {
  await initLocale(params);
  const t = await getTranslations('auth');
  const devLogin = process.env.NEXT_PUBLIC_AUTH_DEV_LOGIN === 'true';
  const { publicDemo, google, accounts } = await loadOptions();

  return (
    <div className="overflow-hidden rounded-[20px] bg-card shadow-soft">
      <div className="bg-brand-gradient px-6 py-8 text-white sm:px-8">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-white/85">
          {publicDemo ? t('publicSubtitle') : t('passwordSubtitle')}
        </p>
      </div>
      <div className="grid gap-6 p-6 sm:p-8">
        {publicDemo ? (
          <Suspense>
            <QuickLogin accounts={accounts} />
          </Suspense>
        ) : (
          <>
            <Suspense>
              <PasswordLogin />
            </Suspense>
            {google && (
              <Suspense>
                <GoogleSignIn />
              </Suspense>
            )}
            {google && (
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
            )}
          </>
        )}
        {devLogin && !publicDemo && (
          <Suspense>
            <DevLogin />
          </Suspense>
        )}
      </div>
    </div>
  );
}
