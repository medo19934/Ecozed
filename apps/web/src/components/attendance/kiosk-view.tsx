'use client';

import type { KioskResult, KioskToken } from '@latif/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, CircleCheck, Expand, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, api, fileUrl } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';

type Feedback = { ok: true; result: KioskResult } | { ok: false; message: string };

function PinBoxes({ onSubmit, busy }: { onSubmit: (pin: string) => void; busy: boolean }) {
  const t = useTranslations('kiosk');
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pin = digits.join('');
  const submit = () => {
    if (pin.length === 6) {
      onSubmit(pin);
      setDigits(Array(6).fill(''));
      refs.current[0]?.focus();
    }
  };
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-center text-sm text-muted-foreground">{t('pinHint')}</p>
      <div dir="ltr" className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={t('digit', { n: i + 1 })}
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            value={d}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(-1);
              const next = [...digits];
              next[i] = v;
              setDigits(next);
              if (v && i < 5) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            }}
            onPaste={(e) => {
              const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
              if (p.length) {
                e.preventDefault();
                setDigits(
                  p
                    .padEnd(6, ' ')
                    .split('')
                    .map((c) => c.trim()),
                );
                refs.current[Math.min(p.length, 5)]?.focus();
              }
            }}
            className="size-12 rounded-xl border border-input bg-muted/50 text-center text-xl font-semibold outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30 sm:size-14"
          />
        ))}
      </div>
      <Button type="submit" size="lg" disabled={pin.length !== 6 || busy}>
        {t('next')} <ArrowRight className="rtl:rotate-180" />
      </Button>
    </form>
  );
}

/** Entrance tablet: rotating server-signed QR + personal PIN. */
export function KioskView() {
  const t = useTranslations('kiosk');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [qr, setQr] = useState<string>('');
  const [left, setLeft] = useState(30);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const token = useQuery({
    queryKey: ['kiosk', 'token'],
    queryFn: () => api.get<KioskToken>('/attendance/kiosk/token'),
    refetchInterval: (q) => Math.max(2, q.state.data?.refreshInSeconds ?? 30) * 1000,
    refetchIntervalInBackground: true,
    retry: (n, e) => !(e instanceof ApiError && e.status === 403) && n < 3,
  });

  useEffect(() => {
    if (!token.data) return;
    void QRCode.toDataURL(token.data.token, {
      width: 520,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1f2433' },
    }).then(setQr);
    setLeft(token.data.refreshInSeconds);
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [token.data]);

  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(id);
  }, [feedback]);

  const pin = useMutation({
    mutationFn: (p: string) => api.post<KioskResult>('/attendance/kiosk/pin', { pin: p }),
    onSuccess: (result) => setFeedback({ ok: true, result }),
    onError: (e) => setFeedback({ ok: false, message: errorMessage(e) }),
  });

  const branch = token.data?.branch;
  const branchName = branch ? (locale === 'en' && branch.nameEn) || branch.name : '';
  const disabled = token.error instanceof ApiError && token.error.status === 403;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <div className="absolute end-4 top-4 flex gap-2">
        <LocaleSwitcher />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void document.documentElement.requestFullscreen?.()}
        >
          <Expand /> {t('fullscreen')}
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">{t('exit')}</Link>
        </Button>
      </div>
      <main className="w-full max-w-xl rounded-[28px] bg-card p-6 shadow-soft sm:p-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {branch?.hasLogo ? (
            <img
              src={fileUrl('/branches/current/logo')}
              alt=""
              className="size-16 rounded-2xl object-contain"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <Sparkles className="size-7" aria-hidden />
            </span>
          )}
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {branchName && <p className="text-muted-foreground">{branchName}</p>}
        </div>

        {disabled ? (
          <p className="rounded-2xl bg-warning/12 p-5 text-center text-sm">{t('disabled')}</p>
        ) : (
          <div className="grid gap-6">
            <div className="grid justify-items-center gap-3">
              <p className="text-sm text-muted-foreground">{t('scanHint')}</p>
              <div className="relative rounded-3xl border bg-white p-3">
                {qr ? (
                  <img src={qr} alt={t('scanHint')} className="size-64 sm:size-72" />
                ) : (
                  <div className="size-64 animate-pulse rounded-2xl bg-muted sm:size-72" />
                )}
              </div>
              <div
                className="flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-brand-gradient transition-[width] duration-1000"
                    style={{ width: `${(left / 30) * 100}%` }}
                  />
                </span>
                {t('refreshIn', { s: left })}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t('or')}
              <span className="h-px flex-1 bg-border" />
            </div>
            <PinBoxes onSubmit={(p) => pin.mutate(p)} busy={pin.isPending} />
          </div>
        )}
      </main>

      {feedback && (
        <div
          role="status"
          aria-live="assertive"
          className={cn(
            'fixed inset-x-4 bottom-6 mx-auto flex max-w-xl items-start gap-4 rounded-3xl p-5 text-white shadow-xl animate-in slide-in-from-bottom-4',
            feedback.ok ? 'bg-success' : 'bg-destructive',
          )}
        >
          {feedback.ok ? (
            <CircleCheck className="size-8 shrink-0" aria-hidden />
          ) : (
            <CircleAlert className="size-8 shrink-0" aria-hidden />
          )}
          {feedback.ok ? (
            <div className="grid gap-1">
              <p className="text-lg font-bold">
                {feedback.result.items[0]?.direction === 'OUT'
                  ? t('goodbye', { name: feedback.result.person })
                  : t('welcome', { name: feedback.result.person })}
              </p>
              <ul className="text-sm text-white/90">
                {feedback.result.items.map((i) => (
                  <li key={`${i.name}-${i.direction}`}>
                    {i.name} — {i.direction === 'IN' ? t('inLabel') : t('outLabel')}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-lg font-semibold">{feedback.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
