import { TRIAL_DAYS } from '@latif/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';
import { Link } from '@/i18n/navigation';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('register') };
}

export default async function RegisterPage({ params }: PageProps<'/[locale]/register'>) {
  await initLocale(params);
  const t = await getTranslations('auth');
  return (
    <AuthCard
      title={t('registerTitle')}
      subtitle={t('registerSubtitle', { days: TRIAL_DAYS })}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('login')}
          </Link>
        </>
      }
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
