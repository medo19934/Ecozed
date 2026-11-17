'use client';

import type { MyAttendance } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';

export const MY_ATTENDANCE_KEY = ['attendance', 'me'] as const;

/** Shows/regenerates the personal kiosk PIN. The PIN is displayed once. */
export function PinDialog({ children }: { children: ReactNode }) {
  const t = useTranslations('pin');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const me = useQuery({
    queryKey: MY_ATTENDANCE_KEY,
    queryFn: () => api.get<MyAttendance>('/attendance/me'),
    enabled: open,
  });
  const gen = useMutation({
    mutationFn: () => api.post<{ pin: string }>('/attendance/me/pin'),
    onSuccess: (r) => {
      setPin(r.pin);
      void qc.invalidateQueries({ queryKey: MY_ATTENDANCE_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const noBranch = me.isError || (me.data && !me.data.date);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPin(null);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t('title')} description={t('body')} closeLabel={tc('close')}>
        <div className="grid justify-items-center gap-5 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <KeyRound className="size-7" aria-hidden />
          </span>
          {pin ? (
            <p
              dir="ltr"
              className="font-mono text-4xl font-bold tracking-[0.4em]"
              aria-live="polite"
            >
              {pin}
            </p>
          ) : noBranch ? (
            <p className="text-sm text-muted-foreground">{t('noBranch')}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {me.data?.hasPin ? t('hasPin') : t('noPin')}
            </p>
          )}
          {!noBranch && (
            <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
              {me.data?.hasPin || pin ? t('regenerate') : t('generate')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
