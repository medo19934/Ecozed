'use client';

import type { KioskPreview, KioskResult } from '@latif/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Loader2, LogIn, LogOut, Smartphone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';

/**
 * Opened by a phone camera from the kiosk QR (`/scan?t=…`), after sign-in if needed:
 * preview (who / which children) → choose → check_in(token) → clear result screen.
 */
export function ScanView() {
  const t = useTranslations('kiosk');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const token = useSearchParams().get('t') ?? '';
  const [picked, setPicked] = useState<string[]>([]);
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');

  const preview = useQuery({
    queryKey: ['kiosk', 'preview', token],
    queryFn: () => api.post<KioskPreview>('/attendance/kiosk/preview', { token }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
  const p = preview.data;
  // Sensible defaults: the children who can do the most common next action.
  useEffect(() => {
    if (!p) return;
    if (p.kind === 'STAFF') {
      if (p.staffNext) setDirection(p.staffNext);
      return;
    }
    const anyIn = p.children.some((c) => c.next === 'IN');
    const dir = anyIn ? 'IN' : 'OUT';
    setDirection(dir);
    setPicked(p.children.filter((c) => c.next === dir).map((c) => c.id));
  }, [p]);

  const scan = useMutation({
    mutationFn: () =>
      api.post<KioskResult>('/attendance/kiosk/scan', {
        token,
        direction,
        ...(p?.kind === 'PARENT' ? { childIds: picked } : {}),
      }),
  });
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  const eligible = p?.children.filter((c) => c.next === direction) ?? [];
  const canSubmit = p?.kind === 'STAFF' ? p.staffNext === direction : picked.length > 0;

  let body;
  if (!token) {
    body = <Status ok={false} title={t('scanInvalid')} />;
  } else if (scan.isSuccess) {
    body = (
      <>
        <CircleCheck className="size-16 text-[#2fb36d]" aria-hidden />
        <p className="text-lg font-semibold">{t('doneTitle')}</p>
        <ul className="grid w-full gap-2">
          {scan.data.items.map((i) => (
            <li
              key={`${i.name}-${i.direction}`}
              className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3"
            >
              <span className="font-medium">{i.name}</span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  i.direction === 'IN' ? 'text-[#2fb36d]' : 'text-primary',
                )}
              >
                {i.direction === 'IN' ? t('inLabel') : t('outLabel')} · {time(i.at)}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (scan.isError) {
    body = <Status ok={false} title={errorMessage(scan.error)} hint={t('scanAgain')} />;
  } else if (preview.isPending) {
    body = (
      <>
        <Loader2 className="size-14 animate-spin text-primary" aria-hidden />
        <p className="text-lg font-semibold">{t('scanning')}</p>
      </>
    );
  } else if (preview.isError || !p) {
    body = <Status ok={false} title={errorMessage(preview.error)} hint={t('scanAgain')} />;
  } else {
    body = (
      <div className="grid w-full gap-4 text-start">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {locale === 'en' && p.branch.nameEn ? p.branch.nameEn : p.branch.name}
          </p>
          <p className="text-lg font-semibold">{p.person}</p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('direction')}>
          {(['IN', 'OUT'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => {
                setDirection(d);
                if (p.kind === 'PARENT')
                  setPicked(p.children.filter((c) => c.next === d).map((c) => c.id));
              }}
              className={cn(
                'flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-base font-semibold',
                direction === d ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
              )}
            >
              {d === 'IN' ? (
                <LogIn className="rtl:-scale-x-100" />
              ) : (
                <LogOut className="rtl:-scale-x-100" />
              )}
              {d === 'IN' ? t('checkIn') : t('checkOut')}
            </button>
          ))}
        </div>
        {p.kind === 'PARENT' ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('whichChildren')}</legend>
            {p.children.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noChildrenHere')}</p>
            )}
            {p.children.map((c) => {
              const ok = c.next === direction;
              return (
                <label
                  key={c.id}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-2xl border px-4',
                    ok ? 'cursor-pointer' : 'opacity-50',
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    disabled={!ok}
                    checked={picked.includes(c.id)}
                    onChange={() =>
                      setPicked((s) =>
                        s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id],
                      )
                    }
                  />
                  <span className="flex-1 font-medium">{c.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`childStatus.${c.status}` as 'childStatus.NO_RECORD')}
                  </span>
                </label>
              );
            })}
            {p.children.length > 0 && eligible.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('nobodyFor')}</p>
            )}
          </fieldset>
        ) : (
          p.staffNext === null && (
            <p className="text-center text-sm text-muted-foreground">{t('alreadyOut')}</p>
          )
        )}
        <Button
          className="min-h-14 text-base"
          disabled={!canSubmit || scan.isPending}
          onClick={() => scan.mutate()}
        >
          {scan.isPending && <Loader2 className="animate-spin" />}
          {t('confirm')}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t('expiresIn', { s: p.expiresInSeconds })}
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#f2f4f5] p-4">
      <div className="grid w-full max-w-md justify-items-center gap-5 rounded-[20px] bg-card p-6 text-center shadow-soft sm:p-8">
        {body}
        <div className="grid w-full gap-2">
          {token && !scan.isSuccess && (
            <Button asChild variant="outline" className="w-full">
              <a href={`latifkids://scan?t=${encodeURIComponent(token)}`}>
                <Smartphone /> {t('openInApp')}
              </a>
            </Button>
          )}
          <Button asChild variant="ghost" className="w-full">
            <Link href="/dashboard">{t('toApp')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Status({ ok, title, hint }: { ok: boolean; title: string; hint?: string }) {
  return (
    <>
      {ok ? (
        <CircleCheck className="size-16 text-[#2fb36d]" aria-hidden />
      ) : (
        <CircleAlert className="size-16 text-destructive" aria-hidden />
      )}
      <p className="text-lg font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </>
  );
}
