'use client';

import { CalendarEventSchema, type CalendarEventDto, type UnitsResponse } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { useClasses, useStaffOptions } from '@/lib/queries';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { useSession } from '@/lib/use-session';

export const TYPES = ['EVENT', 'LESSON', 'ACTIVITY', 'HOLIDAY', 'MEETING', 'TRIP'] as const;

export function EventFormDialog({
  event,
  defaultDate,
  open,
  onOpenChange,
  children,
}: {
  event?: CalendarEventDto;
  defaultDate: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  children?: ReactNode;
}) {
  const t = useTranslations('calendar');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const { data: user } = useSession();
  const classes = useClasses();
  const canStaff = useCan('canAddStaff');
  const staff = useStaffOptions(canStaff);
  const units = useQuery({
    queryKey: ['units', 'ACTIVE', ''],
    queryFn: () => api.get<UnitsResponse>('/units'),
  });
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const blank = {
    title: '',
    description: '',
    type: 'EVENT' as (typeof TYPES)[number],
    audience: 'BRANCH' as 'ALL' | 'BRANCH' | 'CLASS',
    classroomId: '',
    unitId: '',
    teacherId: '',
    startDate: defaultDate,
    endDate: defaultDate,
    startTime: '',
    endTime: '',
  };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!isOpen) return;
    setF(
      event
        ? {
            title: event.title,
            description: event.description ?? '',
            type: event.type,
            audience: event.audience,
            classroomId: event.classroom?.id ?? '',
            unitId: event.unit?.id ?? '',
            teacherId: event.teacher?.membershipId ?? '',
            startDate: event.startDate,
            endDate: event.endDate,
            startTime: event.startTime ?? '',
            endTime: event.endTime ?? '',
          }
        : { ...blank, startDate: defaultDate, endDate: defaultDate },
    );
  }, [isOpen, event, defaultDate]);

  const save = useMutation({
    mutationFn: (body: unknown) =>
      event ? api.put(`/calendar/${event.id}`, body) : api.post('/calendar', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['calendar'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(tc('saved'));
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const opt = (v: string) => v || null;

  const form = (
    <DialogContent
      title={event ? t('edit') : t('add')}
      closeLabel={tc('close')}
      className="sm:max-w-xl"
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = validate(CalendarEventSchema, {
            ...f,
            description: f.description,
            classroomId: opt(f.classroomId),
            unitId: opt(f.unitId),
            teacherId: opt(f.teacherId),
            startTime: opt(f.startTime),
            endTime: opt(f.endTime),
          });
          if (body) save.mutate(body);
        }}
      >
        <FormField
          id="ev-title"
          label={t('titleLabel')}
          error={errors.title}
          className="sm:col-span-2"
        >
          <Input
            id="ev-title"
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            aria-invalid={!!errors.title || undefined}
          />
        </FormField>
        <FormField id="ev-type" label={t('type')}>
          <Select id="ev-type" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`types.${x}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="ev-aud" label={t('audience')}>
          <Select id="ev-aud" value={f.audience} onChange={(e) => set('audience', e.target.value)}>
            {user?.isSuperAdmin && <option value="ALL">{t('audiences.ALL')}</option>}
            <option value="BRANCH">{t('audiences.BRANCH')}</option>
            <option value="CLASS">{t('audiences.CLASS')}</option>
          </Select>
        </FormField>
        {f.audience !== 'ALL' && (
          <>
            <FormField id="ev-class" label={t('class')} error={errors.classroomId}>
              <Select
                id="ev-class"
                value={f.classroomId}
                onChange={(e) => set('classroomId', e.target.value)}
              >
                <option value="">{t('none')}</option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="ev-unit" label={t('unit')}>
              <Select id="ev-unit" value={f.unitId} onChange={(e) => set('unitId', e.target.value)}>
                <option value="">{t('none')}</option>
                {(units.data?.items ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {canStaff && (
              <FormField id="ev-teacher" label={t('teacher')} className="sm:col-span-2">
                <Select
                  id="ev-teacher"
                  value={f.teacherId}
                  onChange={(e) => set('teacherId', e.target.value)}
                >
                  <option value="">{t('none')}</option>
                  {(staff.data ?? []).map((s) => (
                    <option key={s.membershipId} value={s.membershipId}>
                      {s.fullName}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </>
        )}
        <FormField id="ev-start" label={t('startDate')}>
          <Input
            id="ev-start"
            type="date"
            value={f.startDate}
            onChange={(e) =>
              setF((x) => ({
                ...x,
                startDate: e.target.value,
                endDate: x.endDate < e.target.value ? e.target.value : x.endDate,
              }))
            }
          />
        </FormField>
        <FormField id="ev-end" label={t('endDate')} error={errors.endDate}>
          <Input
            id="ev-end"
            type="date"
            min={f.startDate}
            value={f.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
        </FormField>
        <FormField id="ev-from" label={t('startTime')} hint={t('allDay')}>
          <Input
            id="ev-from"
            type="time"
            value={f.startTime}
            onChange={(e) => set('startTime', e.target.value)}
          />
        </FormField>
        <FormField id="ev-to" label={t('endTime')} error={errors.endTime}>
          <Input
            id="ev-to"
            type="time"
            value={f.endTime}
            onChange={(e) => set('endTime', e.target.value)}
          />
        </FormField>
        <FormField id="ev-desc" label={t('description')} className="sm:col-span-2">
          <Textarea
            id="ev-desc"
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </FormField>
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {tc('save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      {form}
    </Dialog>
  );
}
