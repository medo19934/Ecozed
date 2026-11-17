'use client';

import type { AuthUser } from '@latif/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { sessionApi } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { usePostLogin } from '@/lib/use-post-login';

/** Rendered only when NEXT_PUBLIC_AUTH_DEV_LOGIN=true (local development without Google). */
export function DevLogin() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const onLoggedIn = usePostLogin();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-3 rounded-2xl border border-dashed p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const { user } = await sessionApi.devLogin<{ user: AuthUser }>(email.trim());
          onLoggedIn(user);
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Badge variant="warning">{tc('dev')}</Badge>
        {t('devTitle')}
      </p>
      <FormField id="dev-email" label={t('devEmail')}>
        <Input
          id="dev-email"
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormField>
      <Button type="submit" variant="outline" disabled={busy}>
        {t('devSubmit')}
      </Button>
    </form>
  );
}
