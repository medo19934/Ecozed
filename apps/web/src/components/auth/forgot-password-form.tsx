'use client';

import { IdentifierSchema, OTP, PasswordSchema } from '@latif/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { OtpCodeInput } from './otp-code-input';
import { PasswordInput } from './password-input';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'identifier' | 'code' | 'password', string>>>(
    {},
  );

  const request = async () => {
    const id = identifier.trim();
    if (!IdentifierSchema.safeParse(id).success)
      return setErrors({ identifier: t('errors.invalid_email') });
    setErrors({});
    setBusy(true);
    try {
      const res = await api.post<{ devCode?: string }>('/auth/password/forgot', { identifier: id });
      toast.success(
        t('codeSent'),
        res.devCode ? { description: t('devCode', { code: res.devCode }) } : undefined,
      );
      setStep('reset');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const next: typeof errors = {};
    if (code.length !== OTP.LENGTH) next.code = t('errors.invalid_code');
    if (!PasswordSchema.safeParse(password).success) next.password = t('errors.password_too_short');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api.post('/auth/password/reset', { identifier: identifier.trim(), code, password });
      toast.success(t('resetDone'));
      router.replace('/login');
    } catch (e) {
      setErrors({ code: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void (step === 'request' ? request() : reset());
      }}
    >
      <FormField
        id="identifier"
        label={t('identifier')}
        error={errors.identifier}
        hint={t('identifierHint')}
      >
        <Input
          id="identifier"
          dir="ltr"
          autoComplete="username"
          value={identifier}
          disabled={step === 'reset'}
          aria-invalid={errors.identifier ? true : undefined}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </FormField>
      {step === 'reset' && (
        <>
          <FormField id="code" label={t('code')} error={errors.code}>
            <OtpCodeInput
              id="code"
              value={code}
              onChange={setCode}
              invalid={Boolean(errors.code)}
            />
          </FormField>
          <FormField id="password" label={t('newPassword')} error={errors.password}>
            <PasswordInput
              id="password"
              toggleLabel={t('password')}
              autoComplete="new-password"
              value={password}
              aria-invalid={errors.password ? true : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        </>
      )}
      <Button type="submit" size="lg" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {step === 'request' ? t('sendCode') : t('reset')}
      </Button>
      <Link href="/login" className="text-center text-sm text-primary hover:underline">
        {t('backToLogin')}
      </Link>
    </form>
  );
}
