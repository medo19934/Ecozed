'use client';

import { OTP, PhoneSchema, type AuthUser } from '@latif/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Link } from '@/i18n/navigation';
import { api, sessionApi } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { usePostLogin } from '@/lib/use-post-login';
import { OtpCodeInput } from './otp-code-input';
import { PhoneInput } from './phone-input';

export function OtpLoginForm() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const onLoggedIn = usePostLogin();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const requestCode = async () => {
    if (!PhoneSchema.safeParse(phone).success) return setError(t('errors.invalid_phone'));
    setError(undefined);
    setBusy(true);
    try {
      const res = await api.post<{ sent: true; devCode?: string }>('/auth/otp/request', {
        identifier: phone,
        purpose: 'LOGIN',
      });
      toast.success(
        t('codeSent'),
        res.devCode ? { description: t('devCode', { code: res.devCode }) } : undefined,
      );
      setStep('code');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== OTP.LENGTH) return setError(t('errors.invalid_code'));
    setError(undefined);
    setBusy(true);
    try {
      const { user } = await sessionApi.verifyOtp<{ user: AuthUser }>({ identifier: phone, code });
      onLoggedIn(user);
    } catch (e) {
      setError(errorMessage(e));
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
        void (step === 'phone' ? requestCode() : verify());
      }}
    >
      {step === 'phone' ? (
        <FormField id="phone" label={t('phone')} error={error}>
          <PhoneInput
            id="phone"
            value={phone}
            onChange={setPhone}
            invalid={Boolean(error)}
            describedBy={error ? 'phone-error' : undefined}
            codeLabel={t('countryCode')}
          />
        </FormField>
      ) : (
        <FormField id="code" label={t('code')} error={error}>
          <OtpCodeInput id="code" value={code} onChange={setCode} invalid={Boolean(error)} />
        </FormField>
      )}
      <Button type="submit" size="lg" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {step === 'phone' ? t('sendCode') : t('verify')}
      </Button>
      {step === 'code' && (
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void requestCode()}>
          {t('resend')}
        </Button>
      )}
      <Link href="/login" className="text-center text-sm text-primary hover:underline">
        {t('backToLogin')}
      </Link>
    </form>
  );
}
