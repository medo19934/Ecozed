import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('forgotTitle') };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<'/[locale]/forgot-password'>) {
  await initLocale(params);
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('forgotTitle')} subtitle={t('forgotSubtitle')}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
