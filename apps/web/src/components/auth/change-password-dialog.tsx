'use client';

import { ChangePasswordSchema } from '@latif/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { useSessionActions } from '@/lib/use-session';

/**
 * Change password. `forced`: shown after signing in with a temporary password
 * (cannot be dismissed, no current password needed).
 */
export function ChangePasswordDialog({
  children,
  forced,
}: {
  children?: ReactNode;
  forced?: boolean;
}) {
  const t = useTranslations('credentials');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const { refresh } = useSessionActions();
  const [open, setOpen] = useState(Boolean(forced));
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const save = useMutation({
    mutationFn: (body: unknown) => api.post('/auth/password', body),
    onSuccess: async () => {
      toast.success(t('changed'));
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      setOpen(false);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const mismatch = f.confirm.length > 0 && f.confirm !== f.newPassword;

  return (
    <Dialog open={open} onOpenChange={(o) => !forced && setOpen(o)}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        title={forced ? t('forcedTitle') : t('changeTitle')}
        description={forced ? t('forcedHint') : undefined}
        closeLabel={tc('close')}
        onInteractOutside={(e) => forced && e.preventDefault()}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
      >
        <form
          id="change-password"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (mismatch) return;
            const body = validate(ChangePasswordSchema, {
              currentPassword: forced ? undefined : f.currentPassword,
              newPassword: f.newPassword,
            });
            if (body) save.mutate(body);
          }}
        >
          {!forced && (
            <FormField id="cp-current" label={t('current')}>
              <Input
                id="cp-current"
                dir="ltr"
                type="password"
                autoComplete="current-password"
                value={f.currentPassword}
                onChange={(e) => setF({ ...f, currentPassword: e.target.value })}
              />
            </FormField>
          )}
          <FormField id="cp-new" label={t('new')} error={errors.newPassword} hint={t('rule')}>
            <Input
              id="cp-new"
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={f.newPassword}
              onChange={(e) => setF({ ...f, newPassword: e.target.value })}
            />
          </FormField>
          <FormField
            id="cp-confirm"
            label={t('confirm')}
            error={mismatch ? t('mismatch') : undefined}
          >
            <Input
              id="cp-confirm"
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={f.confirm}
              onChange={(e) => setF({ ...f, confirm: e.target.value })}
            />
          </FormField>
        </form>
        <DialogFooter>
          <Button type="submit" form="change-password" disabled={save.isPending}>
            {tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
