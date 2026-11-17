'use client';

import { ClassroomSchema, type ClassroomDto } from '@latif/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { useStaffOptions } from '@/lib/queries';

const COLORS = ['#5b6db4', '#7b649b', '#2fb36d', '#f2a33a', '#e5484d', '#0ea5e9'];

export function ClassFormDialog({
  classroom,
  children,
}: {
  classroom?: ClassroomDto;
  children: ReactNode;
}) {
  const t = useTranslations('classes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const canListStaff = useCan('canAddStaff');
  const staff = useStaffOptions(canListStaff);
  const [open, setOpen] = useState(false);
  const blank = {
    name: '',
    capacity: '15',
    minAgeMonths: '',
    maxAgeMonths: '',
    color: COLORS[0]!,
    teacherIds: [] as string[],
  };
  const [f, setF] = useState(blank);

  useEffect(() => {
    if (!open) return;
    setF(
      classroom
        ? {
            name: classroom.name,
            capacity: String(classroom.capacity),
            minAgeMonths: classroom.minAgeMonths?.toString() ?? '',
            maxAgeMonths: classroom.maxAgeMonths?.toString() ?? '',
            color: classroom.color ?? COLORS[0]!,
            teacherIds: classroom.teachers.map((x) => x.membershipId),
          }
        : blank,
    );
  }, [open, classroom]);

  const save = useMutation({
    mutationFn: (body: unknown) =>
      classroom
        ? api.put<ClassroomDto>(`/classes/${classroom.id}`, body)
        : api.post<ClassroomDto>('/classes', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(tc('saved'));
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const opt = (v: string) => (v.trim() === '' ? null : Number(v));
  const submit = () => {
    const body = validate(ClassroomSchema, {
      name: f.name,
      capacity: Number(f.capacity),
      minAgeMonths: opt(f.minAgeMonths),
      maxAgeMonths: opt(f.maxAgeMonths),
      color: f.color,
      teacherIds: f.teacherIds,
    });
    if (body) save.mutate(body);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={classroom ? t('edit') : t('add')} closeLabel={tc('close')}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField id="c-name" label={t('name')} error={errors.name}>
            <Input
              id="c-name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              aria-invalid={!!errors.name || undefined}
            />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField id="c-cap" label={t('capacity')} error={errors.capacity}>
              <Input
                id="c-cap"
                type="number"
                min={1}
                dir="ltr"
                value={f.capacity}
                onChange={(e) => setF({ ...f, capacity: e.target.value })}
              />
            </FormField>
            <FormField id="c-min" label={t('minAge')} error={errors.minAgeMonths}>
              <Input
                id="c-min"
                type="number"
                min={0}
                dir="ltr"
                value={f.minAgeMonths}
                onChange={(e) => setF({ ...f, minAgeMonths: e.target.value })}
              />
            </FormField>
            <FormField id="c-max" label={t('maxAge')} error={errors.maxAgeMonths}>
              <Input
                id="c-max"
                type="number"
                min={0}
                dir="ltr"
                value={f.maxAgeMonths}
                onChange={(e) => setF({ ...f, maxAgeMonths: e.target.value })}
              />
            </FormField>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t('color')}</legend>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={f.color === c}
                  onClick={() => setF({ ...f, color: c })}
                  className="size-8 rounded-full ring-offset-2 ring-offset-card aria-pressed:ring-2 aria-pressed:ring-foreground"
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>
          {canListStaff && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">{t('teachers')}</legend>
              <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border p-2">
                {(staff.data ?? []).map((s) => (
                  <li key={s.membershipId}>
                    <label className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-muted">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={f.teacherIds.includes(s.membershipId)}
                        onChange={(e) =>
                          setF({
                            ...f,
                            teacherIds: e.target.checked
                              ? [...f.teacherIds, s.membershipId]
                              : f.teacherIds.filter((x) => x !== s.membershipId),
                          })
                        }
                      />
                      <Avatar name={s.fullName} src={s.avatarUrl} className="size-7" />
                      <span className="text-sm">{s.fullName}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
