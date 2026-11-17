import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { Link } from '@/i18n/navigation';
import { initLocale } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('login') };
}

export default async function LoginPage({ params }: PageProps<'/[locale]/login'>) {
  await initLocale(params);
  const t = await getTranslations('auth');
  return (
    <AuthCard
      title={t('loginTitle')}
      subtitle={t('loginSubtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('registerCta')}
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
