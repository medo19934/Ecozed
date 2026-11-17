'use client';

import { VacationRequestSchema, localDate, type ParentChildDto } from '@latif/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';

export function VacationDialog({
  kids,
  children,
}: {
  kids: ParentChildDto[];
  children: ReactNode;
}) {
  const t = useTranslations('parent');
  const ta = useTranslations('attendance');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const today = localDate();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    childId: kids[0]?.id ?? '',
    startDate: today,
    endDate: today,
    reason: '',
  });
  const send = useMutation({
    mutationFn: (body: unknown) => api.post('/attendance/vacations', body),
    onSuccess: () => {
      toast.success(t('sent'));
      void qc.invalidateQueries({ queryKey: ['vacations', 'mine'] });
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t('vacationTitle')} closeLabel={tc('close')}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const body = validate(VacationRequestSchema, { ...f, reason: f.reason || undefined });
            if (body) send.mutate(body);
          }}
        >
          <FormField id="v-child" label={t('child')}>
            <Select
              id="v-child"
              value={f.childId}
              onChange={(e) => setF({ ...f, childId: e.target.value })}
            >
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.fullName}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="v-from" label={ta('from')} error={errors.startDate}>
              <Input
                id="v-from"
                type="date"
                min={today}
                value={f.startDate}
                onChange={(e) => setF({ ...f, startDate: e.target.value })}
              />
            </FormField>
            <FormField id="v-to" label={ta('to')} error={errors.endDate}>
              <Input
                id="v-to"
                type="date"
                min={f.startDate}
                value={f.endDate}
                onChange={(e) => setF({ ...f, endDate: e.target.value })}
              />
            </FormField>
          </div>
          <FormField id="v-reason" label={ta('reason')}>
            <Textarea
              id="v-reason"
              value={f.reason}
              onChange={(e) => setF({ ...f, reason: e.target.value })}
            />
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={send.isPending || !f.childId}>
              {t('requestVacation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
