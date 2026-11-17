'use client';

import type { AuthUser } from '@latif/shared';
import Script from 'next/script';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { sessionApi } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { usePostLogin } from '@/lib/use-post-login';

interface GoogleId {
  initialize(opts: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    ux_mode?: 'popup';
  }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/** Google Identity Services button → ID token → /bff/auth/google (sign up or sign in). */
export function GoogleSignIn() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const onLoggedIn = usePostLogin();
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  const onCredential = useCallback(
    async ({ credential }: { credential: string }) => {
      try {
        const { user } = await sessionApi.google<{ user: AuthUser }>(credential, locale);
        onLoggedIn(user);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [locale, onLoggedIn, errorMessage],
  );

  useEffect(() => {
    const g = window.google?.accounts.id;
    if (!loaded || !g || !ref.current || !CLIENT_ID) return;
    g.initialize({ client_id: CLIENT_ID, callback: onCredential, ux_mode: 'popup' });
    g.renderButton(ref.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'center',
      width: Math.min(ref.current.offsetWidth || 360, 400),
      locale,
    });
  }, [loaded, locale, onCredential]);

  if (!CLIENT_ID) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-dashed border-warning/60 bg-warning/10 p-4 text-sm"
      >
        {t('googleMissing')}
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div ref={ref} className="flex min-h-11 w-full justify-center" />
    </>
  );
}
