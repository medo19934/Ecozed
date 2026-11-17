'use client';

import type { MessageContacts, ThreadDto } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';

type Kind = 'CHILD' | 'STAFF' | 'ANNOUNCEMENT';

/** Start (or reopen) a conversation: about a child, with a colleague, or an announcement. */
export function NewMessageDialog({
  children,
  onOpened,
}: {
  children: ReactNode;
  onOpened: (thread: ThreadDto) => void;
}) {
  const t = useTranslations('messages');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('CHILD');
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const contacts = useQuery({
    queryKey: ['messages', 'contacts'],
    queryFn: () => api.get<MessageContacts>('/messages/contacts'),
    enabled: open,
  });
  const c = contacts.data;
  const kinds: Kind[] = ['CHILD', ...(c && c.staff.length ? (['STAFF'] as const) : []), ...(c?.canAnnounce ? (['ANNOUNCEMENT'] as const) : [])];

  const start = useMutation({
    mutationFn: () =>
      api.post<ThreadDto>(
        '/messages/threads',
        kind === 'CHILD'
          ? { kind, childId: target }
          : kind === 'STAFF'
            ? { kind, userId: target }
            : { kind, title: title.trim(), classroomId: target || undefined },
      ),
    onSuccess: (thread) => {
      void qc.invalidateQueries({ queryKey: ['messages', 'threads'] });
      setOpen(false);
      setTarget('');
      setTitle('');
      onOpened(thread);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = kind === 'ANNOUNCEMENT' ? title.trim().length > 0 : Boolean(target);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t('new')} closeLabel={tc('close')}>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setTarget('');
                }}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm',
                  kind === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                )}
              >
                {t(`kinds.${k}`)}
              </button>
            ))}
          </div>
          {kind === 'CHILD' && (
            <FormField id="nm-child" label={t('child')}>
              <Select id="nm-child" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{t('choose')}</option>
                {c?.children.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.fullName}
                    {x.classroom ? ` — ${x.classroom}` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {kind === 'STAFF' && (
            <FormField id="nm-staff" label={t('colleague')}>
              <Select id="nm-staff" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{t('choose')}</option>
                {c?.staff.map((x) => (
                  <option key={x.userId} value={x.userId}>
                    {x.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {kind === 'ANNOUNCEMENT' && (
            <>
              <FormField id="nm-title" label={t('announcementTitle')}>
                <Input id="nm-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              </FormField>
              <FormField id="nm-class" label={t('audience')}>
                <Select id="nm-class" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">{t('wholeBranch')}</option>
                  {c?.classes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!valid || start.isPending} onClick={() => start.mutate()}>
            {t('start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
