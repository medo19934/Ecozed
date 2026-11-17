'use client';

import type { KioskResult } from '@latif/shared';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';

/** Opened by a phone camera from the kiosk QR (`/scan?t=…`): records the signed-in user's check-in/out. */
export function ScanView() {
  const t = useTranslations('kiosk');
  const errorMessage = useErrorMessage();
  const token = useSearchParams().get('t') ?? '';
  const scan = useMutation({
    mutationFn: () => api.post<KioskResult>('/attendance/kiosk/scan', { token }),
  });
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !token) return;
    fired.current = true;
    scan.mutate();
  }, [token, scan]);

  return (
    <div className="grid min-h-dvh place-items-center bg-[#f2f4f5] p-6">
      <div className="grid w-full max-w-md justify-items-center gap-5 rounded-[20px] bg-card p-8 text-center shadow-soft">
        {!token ? (
          <>
            <CircleAlert className="size-16 text-destructive" />
            <p className="text-lg font-semibold">{t('scanInvalid')}</p>
          </>
        ) : scan.isPending || scan.isIdle ? (
          <>
            <Loader2 className="size-14 animate-spin text-primary" />
            <p className="text-lg font-semibold">{t('scanning')}</p>
          </>
        ) : scan.isSuccess ? (
          <>
            <CircleCheck className="size-16 text-[#2fb36d]" />
            {scan.data.items.length === 0 && (
              <p className="text-lg font-semibold">{t('nothingToRecord')}</p>
            )}
            {scan.data.items.map((i) => (
              <p key={`${i.name}-${i.direction}`} className="text-lg font-semibold">
                {i.name} — {i.direction === 'IN' ? t('inLabel') : t('outLabel')}
              </p>
            ))}
          </>
        ) : (
          <>
            <CircleAlert className="size-16 text-destructive" />
            <p className="text-lg font-semibold">{errorMessage(scan.error)}</p>
          </>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">{t('toApp')}</Link>
        </Button>
      </div>
    </div>
  );
}
