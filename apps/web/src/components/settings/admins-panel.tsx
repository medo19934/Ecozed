'use client';

import type { IssuedPassword } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { IssuedPasswordDialog } from '@/components/auth/issued-password-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { useSession } from '@/lib/use-session';

interface Admin {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  lastLoginAt: string | null;
}

/** General administration accounts (all branches). Super admins only. */
export function AdminsPanel() {
  const t = useTranslations('admins');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { data: me } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const list = useQuery({ queryKey: ['admins'], queryFn: () => api.get<Admin[]>('/admins') });
  const add = useMutation({
    mutationFn: () =>
      api.post<{ issued: IssuedPassword | null }>('/admins', {
        identifier,
        fullName: fullName || undefined,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['admins'] });
      setIdentifier('');
      setFullName('');
      if (r.issued) setIssued(r.issued);
      else toast.success(t('granted'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admins/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admins'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="grid gap-5">
      <IssuedPasswordDialog issued={issued} onClose={() => setIssued(null)} />
      <Card className="grid gap-4 p-5">
        <div>
          <h2 className="font-semibold">{t('addTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('addHint')}</p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (identifier.trim()) add.mutate();
          }}
        >
          <FormField id="ad-id" label={t('identifier')}>
            <Input
              id="ad-id"
              dir="ltr"
              placeholder="name@example.com · 05XXXXXXXX"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </FormField>
          <FormField id="ad-name" label={t('name')}>
            <Input id="ad-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormField>
          <Button type="submit" disabled={add.isPending}>
            <UserPlus /> {t('add')}
          </Button>
        </form>
      </Card>
      <Card className="grid gap-2 p-5">
        <h2 className="font-semibold">{t('listTitle')}</h2>
        {list.isPending ? (
          <Skeleton className="h-24" />
        ) : (
          list.data?.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border p-3">
              <ShieldCheck className="size-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.fullName}</p>
                <p dir="ltr" className="truncate text-start text-sm text-muted-foreground">
                  {a.email ?? a.phone}
                </p>
              </div>
              {a.id !== me?.id && (
                <Confirm
                  title={t('removeTitle')}
                  body={t('removeHint', { name: a.fullName })}
                  confirmLabel={tc('delete')}
                  destructive
                  onConfirm={() => remove.mutate(a.id)}
                >
                  <Button variant="ghost" size="icon" aria-label={tc('delete')}>
                    <Trash2 />
                  </Button>
                </Confirm>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
