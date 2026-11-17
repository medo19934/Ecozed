'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type AuthUser, type LoginInput } from '@latif/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldAria } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { sessionApi } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { usePostLogin } from '@/lib/use-post-login';
import { PasswordInput } from './password-input';

export function LoginForm() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const onLoggedIn = usePostLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { user } = await sessionApi.login<{ user: AuthUser }>(values);
      onLoggedIn(user);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const idErr = errors.identifier ? t('errors.invalid_email') : undefined;
  const pwErr = errors.password ? t('errors.required') : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField id="identifier" label={t('identifier')} error={idErr} hint={t('identifierHint')}>
        <Input
          {...fieldAria('identifier', idErr, t('identifierHint'))}
          autoComplete="username"
          dir="ltr"
          {...register('identifier', { setValueAs: (v: string) => v.trim() })}
        />
      </FormField>
      <FormField id="password" label={t('password')} error={pwErr}>
        <PasswordInput
          {...fieldAria('password', pwErr)}
          toggleLabel={t('password')}
          autoComplete="current-password"
          {...register('password')}
        />
      </FormField>
      <div className="-mt-2 text-end">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          {t('forgot')}
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        {t('login')}
      </Button>
      <Button variant="outline" asChild>
        <Link href="/otp">{t('loginWithOtp')}</Link>
      </Button>
    </form>
  );
}
