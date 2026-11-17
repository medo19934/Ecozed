import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { OtpLoginForm } from '@/components/auth/otp-login-form';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('otpTitle') };
}

export default async function OtpPage({ params }: PageProps<'/[locale]/otp'>) {
  await initLocale(params);
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('otpTitle')} subtitle={t('otpSubtitle')}>
      <Suspense>
        <OtpLoginForm />
      </Suspense>
    </AuthCard>
  );
}
