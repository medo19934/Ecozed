'use client';

import { AlertDialog as A } from 'radix-ui';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { buttonVariants } from './button';

/** Confirm dialog wrapping a trigger. */
export function Confirm({
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  children,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | void;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <A.Root open={open} onOpenChange={setOpen}>
      <A.Trigger asChild>{children}</A.Trigger>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <A.Content className="fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-y-1/2 rounded-[20px] bg-card p-6 shadow-xl ltr:-translate-x-1/2 rtl:translate-x-1/2">
          <A.Title className="text-lg font-semibold">{title}</A.Title>
          <A.Description className="mt-2 text-sm text-muted-foreground">
            {body ?? title}
          </A.Description>
          <div className="mt-6 flex justify-end gap-2">
            <A.Cancel className={buttonVariants({ variant: 'outline' })}>{t('cancel')}</A.Cancel>
            <button
              type="button"
              disabled={busy}
              className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
