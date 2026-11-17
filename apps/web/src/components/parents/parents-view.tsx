'use client';

import {
  AddParentSchema,
  type ChildListItem,
  type IssuedPassword,
  type Paginated,
  type ParentListItem,
} from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Contact, KeyRound, Mail, Phone, Plus, Search } from 'lucide-react';
import { IssuedPasswordDialog } from '@/components/auth/issued-password-dialog';
import { Confirm } from '@/components/ui/confirm';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';

export function ParentsView() {
  const t = useTranslations('parents');
  const [search, setSearch] = useState('');
  const canAdd = useCan('canAddChild');
  const q = useQuery({
    queryKey: ['parents', search],
    queryFn: () =>
      api.get<ParentListItem[]>(`/parents${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  const rows = q.data ?? [];
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const tcr = useTranslations('credentials');
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const account = useMutation({
    mutationFn: (v: { key: string; reset: boolean }) =>
      api.post<{ issued: IssuedPassword | null }>('/parents/account', v),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['parents'] });
      if (r.issued) setIssued(r.issued);
      else toast.success(tcr('linked'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <IssuedPasswordDialog issued={issued} onClose={() => setIssued(null)} />
        {canAdd && (
          <AddParentDialog onIssued={setIssued}>
            <Button>
              <Plus /> {t('add')}
            </Button>
          </AddParentDialog>
        )}
      </div>
      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {q.isPending ? (
          <Skeleton className="h-48" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Contact} title={t('empty')} />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>{t('name')}</Th>
                <Th>{t('contact')}</Th>
                <Th>{t('children')}</Th>
                <Th>{t('account')}</Th>
                {canAdd && <Th />}
                {canAdd && <Th />}
              </Tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <Tr key={p.key}>
                  <Td>
                    <p className="font-medium">{p.fullName}</p>
                    <p className="text-xs text-muted-foreground">{p.relationship}</p>
                  </Td>
                  <Td>
                    <div className="grid gap-1 text-sm" dir="ltr">
                      {p.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3.5 text-muted-foreground" /> {p.email}
                        </span>
                      )}
                      {p.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3.5 text-muted-foreground" /> {p.phone}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {p.children.map((c) => (
                        <Badge key={c.id} variant="muted">
                          {c.fullName}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={p.linked ? 'success' : 'warning'}>
                      {p.linked ? t('active') : t('invited')}
                    </Badge>
                  </Td>
                  {canAdd && (
                    <Td className="text-end">
                      {p.linked ? (
                        <Confirm
                          title={tcr('resetTitle')}
                          body={tcr('resetHint', { name: p.fullName })}
                          confirmLabel={tcr('reset')}
                          onConfirm={() => account.mutate({ key: p.key, reset: true })}
                        >
                          <Button variant="ghost" size="sm" disabled={account.isPending}>
                            <KeyRound /> {tcr('reset')}
                          </Button>
                        </Confirm>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={account.isPending}
                          onClick={() => account.mutate({ key: p.key, reset: false })}
                        >
                          <KeyRound /> {tcr('createLogin')}
                        </Button>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function AddParentDialog({
  children,
  onIssued,
}: {
  children: React.ReactNode;
  onIssued: (i: IssuedPassword) => void;
}) {
  const t = useTranslations('parents');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const [open, setOpen] = useState(false);
  const blank = { fullName: '', relationship: '', email: '', phone: '', childIds: [] as string[] };
  const [f, setF] = useState(blank);
  const kids = useQuery({
    queryKey: ['children', 'pick'],
    queryFn: () => api.get<Paginated<ChildListItem>>('/children?pageSize=100&status=ACTIVE'),
    enabled: open,
  });
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api.post<ParentListItem & { issued: IssuedPassword | null }>('/parents', body),
    onSuccess: (r) => {
      if (r.issued) onIssued(r.issued);
      void qc.invalidateQueries({ queryKey: ['parents'] });
      void qc.invalidateQueries({ queryKey: ['children'] });
      toast.success(t('added'));
      setF(blank);
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = (id: string) =>
    setF((s) => ({
      ...s,
      childIds: s.childIds.includes(id) ? s.childIds.filter((x) => x !== id) : [...s.childIds, id],
    }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t('add')} description={t('addHint')} closeLabel={tc('close')}>
        <form
          id="add-parent"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const body = validate(AddParentSchema, f);
            if (body) save.mutate(body);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="p-name" label={t('name')} error={errors.fullName}>
              <Input
                id="p-name"
                value={f.fullName}
                onChange={(e) => setF({ ...f, fullName: e.target.value })}
              />
            </FormField>
            <FormField id="p-rel" label={t('relationship')} error={errors.relationship}>
              <Input
                id="p-rel"
                placeholder={t('relationshipHint')}
                value={f.relationship}
                onChange={(e) => setF({ ...f, relationship: e.target.value })}
              />
            </FormField>
            <FormField id="p-email" label={t('email')} error={errors.email}>
              <Input
                id="p-email"
                type="email"
                dir="ltr"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </FormField>
            <FormField id="p-phone" label={t('phone')} error={errors.phone}>
              <Input
                id="p-phone"
                type="tel"
                dir="ltr"
                placeholder="05XXXXXXXX"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
              />
            </FormField>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t('pickChildren')}</legend>
            {errors.childIds && (
              <p className="text-sm text-destructive">{t('pickChildrenError')}</p>
            )}
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border p-2">
              {kids.isPending ? (
                <Skeleton className="h-20" />
              ) : (kids.data?.items.length ?? 0) === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">{t('noChildren')}</p>
              ) : (
                kids.data!.items.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={f.childIds.includes(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="flex-1">{c.fullName}</span>
                    {c.classroom && (
                      <span className="text-xs text-muted-foreground">{c.classroom.name}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </fieldset>
        </form>
        <DialogFooter>
          <Button type="submit" form="add-parent" disabled={save.isPending}>
            {tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
