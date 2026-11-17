'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type AuthUser, type RegisterInput } from '@latif/shared';
import { Check, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField, fieldAria } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { sessionApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useErrorMessage } from '@/lib/use-error-message';
import { usePostLogin } from '@/lib/use-post-login';
import { PasswordInput } from './password-input';
import { PhoneInput } from './phone-input';

type FormValues = z.input<typeof RegisterSchema>;

const STEPS = ['account', 'setup', 'services', 'start'] as const;

/** Onboarding stepper (step 1 active). Steps 2–4 are built in Phase 2. */
function Stepper() {
  const t = useTranslations('auth.steps');
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Onboarding">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-col items-center gap-1.5 text-center">
          <span
            aria-current={i === 0 ? 'step' : undefined}
            className={cn(
              'flex size-8 items-center justify-center rounded-full text-xs font-semibold',
              i === 0
                ? 'bg-brand-gradient text-white shadow-soft'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {i + 1}
          </span>
          <span
            className={cn(
              'text-[11px] leading-tight',
              i === 0 ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {t(s)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale() as RegisterInput['locale'];
  const errorMessage = useErrorMessage();
  const onLoggedIn = usePostLogin();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { locale, phone: '' },
  });

  const err = (key: keyof FormValues): string | undefined => {
    const e = errors[key];
    if (!e) return undefined;
    const code =
      e.message && e.message.includes('_')
        ? e.message
        : key === 'email'
          ? 'invalid_email'
          : 'required';
    return errorMessage(code);
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { user } = await sessionApi.register<{ user: AuthUser }>(values);
      onLoggedIn(user);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <>
      <Stepper />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField id="fullName" label={t('fullName')} error={err('fullName')}>
          <Input
            {...fieldAria('fullName', err('fullName'))}
            autoComplete="name"
            {...register('fullName')}
          />
        </FormField>
        <FormField id="daycareName" label={t('daycareName')} error={err('daycareName')}>
          <Input
            {...fieldAria('daycareName', err('daycareName'))}
            autoComplete="organization"
            {...register('daycareName')}
          />
        </FormField>
        <FormField id="email" label={t('email')} error={err('email')}>
          <Input
            {...fieldAria('email', err('email'))}
            type="email"
            dir="ltr"
            autoComplete="email"
            {...register('email')}
          />
        </FormField>
        <FormField id="phone" label={t('phone')} error={err('phone')}>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="phone"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.phone)}
                describedBy={errors.phone ? 'phone-error' : undefined}
                codeLabel={t('countryCode')}
              />
            )}
          />
        </FormField>
        <FormField id="password" label={t('password')} error={err('password')}>
          <PasswordInput
            {...fieldAria('password', err('password'))}
            toggleLabel={t('password')}
            autoComplete="new-password"
            {...register('password')}
          />
        </FormField>
        <Button type="submit" size="lg" className="mt-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {t('register')}
        </Button>
      </form>
    </>
  );
}
