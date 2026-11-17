'use client';

import { IdentifierLoginSchema, RegisterSchema, type AuthUser } from '@latif/shared';
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { sessionApi } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { usePostLogin } from '@/lib/use-post-login';
import { cn } from '@/lib/utils';

/** Email or phone + password; parents can create their own account. */
export function PasswordLogin({ allowRegister = true }: { allowRegister?: boolean }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const onLoggedIn = usePostLogin();
  const { errors, validate } = useFieldErrors();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ fullName: '', identifier: '', password: '' });

  const submit = async () => {
    const body =
      mode === 'login'
        ? validate(IdentifierLoginSchema, {
            identifier: f.identifier,
            password: f.password,
            locale,
          })
        : validate(RegisterSchema, { ...f, locale });
    if (!body) return;
    if (mode === 'login' && !f.password) return;
    setBusy(true);
    try {
      const { user } =
        mode === 'login'
          ? await sessionApi.login<{ user: AuthUser }>(body.identifier, locale, f.password)
          : await sessionApi.register<{ user: AuthUser }>({
              ...f,
              identifier: body.identifier,
              locale,
            });
      onLoggedIn(user);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5">
      {allowRegister && (
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm',
                mode === m ? 'bg-card font-semibold shadow-xs' : 'text-muted-foreground',
              )}
            >
              {t(m === 'login' ? 'tabLogin' : 'tabRegister')}
            </button>
          ))}
        </div>
      )}
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode === 'register' && (
          <FormField id="r-name" label={t('fullName')} error={errors.fullName}>
            <Input
              id="r-name"
              autoComplete="name"
              value={f.fullName}
              onChange={(e) => setF({ ...f, fullName: e.target.value })}
            />
          </FormField>
        )}
        <FormField id="identifier" label={t('identifier')} error={errors.identifier}>
          <Input
            id="identifier"
            dir="ltr"
            autoComplete="username"
            inputMode="email"
            placeholder="name@example.com · 05XXXXXXXX"
            value={f.identifier}
            onChange={(e) => setF({ ...f, identifier: e.target.value })}
          />
        </FormField>
        <FormField
          id="password"
          label={t('password')}
          error={errors.password}
          hint={mode === 'register' ? t('passwordHint') : undefined}
        >
          <div className="relative">
            <Input
              id="password"
              dir="ltr"
              type={show ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={f.password}
              required
              onChange={(e) => setF({ ...f, password: e.target.value })}
              className="pe-11"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={t(show ? 'hidePassword' : 'showPassword')}
              className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : mode === 'login' ? (
            <LogIn className="rtl:-scale-x-100" />
          ) : (
            <UserPlus />
          )}
          {t(mode === 'login' ? 'signIn' : 'createAccount')}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t(mode === 'login' ? 'loginHelp' : 'registerHelp')}
        </p>
      </form>
    </div>
  );
}
