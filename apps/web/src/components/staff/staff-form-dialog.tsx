'use client';

import {
  ALL_STAFF_PERMISSIONS,
  CreateStaffSchema,
  UpdateStaffSchema,
  type StaffDetail,
  type StaffPermission,
} from '@latif/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useClasses } from '@/lib/queries';
import { isBranchAdmin } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { useSession } from '@/lib/use-session';

const SPECIALTIES_AR = [
  'لغة عربية',
  'تربية إسلامية',
  'فنون',
  'رياضيات',
  'لغة إنجليزية',
  'رياضة',
  'مونتيسوري',
];

export function StaffFormDialog({ staff, children }: { staff?: StaffDetail; children: ReactNode }) {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const { data: me } = useSession();
  const classes = useClasses();
  const [open, setOpen] = useState(false);
  const blank = {
    email: '',
    fullName: '',
    phone: '',
    role: 'STAFF' as 'STAFF' | 'MANAGER',
    staffType: 'TEACHER' as 'TEACHER' | 'ASSISTANT' | 'ADMIN',
    specialties: [] as string[],
    qualification: '',
    address: '',
    joinDate: new Date().toISOString().slice(0, 10),
    classIds: [] as string[],
    permissions: ['canViewMessages', 'canManageAttendance'] as StaffPermission[],
  };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(
      staff
        ? {
            email: staff.email ?? '',
            fullName: staff.fullName,
            phone: staff.phone ?? '',
            role: staff.role,
            staffType: staff.staffType ?? 'TEACHER',
            specialties: staff.specialties,
            qualification: staff.qualification ?? '',
            address: staff.address ?? '',
            joinDate: staff.joinDate ?? '',
            classIds: staff.classes.map((c) => c.id),
            permissions: staff.permissions as StaffPermission[],
          }
        : blank,
    );
  }, [open, staff]);

  const save = useMutation({
    mutationFn: (body: unknown) =>
      staff
        ? api.patch<StaffDetail>(`/staff/${staff.membershipId}`, body)
        : api.post<StaffDetail>('/staff', body),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(tc('saved'));
      setOpen(false);
      if (!staff) router.push(`/staff/${s.membershipId}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const admin = isBranchAdmin(me);
  const submit = () => {
    const common = {
      fullName: f.fullName,
      phone: f.phone,
      role: f.role,
      staffType: f.staffType,
      specialties: f.specialties,
      qualification: f.qualification || null,
      address: f.address || null,
      joinDate: f.joinDate || null,
      classIds: f.classIds,
      ...(admin ? { permissions: f.permissions } : {}),
    };
    const body = staff
      ? validate(UpdateStaffSchema, common)
      : validate(CreateStaffSchema, { ...common, email: f.email });
    if (body) save.mutate(body);
  };
  const toggle = <K extends 'classIds' | 'permissions'>(k: K, v: string, on: boolean) =>
    setF((x) => ({ ...x, [k]: on ? [...x[k], v] : x[k].filter((y: string) => y !== v) }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={staff ? t('edit') : t('add')}
        closeLabel={tc('close')}
        className="sm:max-w-2xl"
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField
            id="s-email"
            label={t('email')}
            hint={t('emailHint')}
            error={errors.email}
            className="sm:col-span-2"
          >
            <Input
              id="s-email"
              type="email"
              dir="ltr"
              value={f.email}
              disabled={!!staff}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </FormField>
          <FormField id="s-name" label={t('fullName')} error={errors.fullName}>
            <Input
              id="s-name"
              value={f.fullName}
              onChange={(e) => setF({ ...f, fullName: e.target.value })}
            />
          </FormField>
          <FormField id="s-phone" label={t('phone')} error={errors.phone}>
            <Input
              id="s-phone"
              dir="ltr"
              inputMode="tel"
              placeholder="+9665XXXXXXXX"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
            />
          </FormField>
          <FormField id="s-role" label={t('role')}>
            <Select
              id="s-role"
              value={f.role}
              disabled={!me?.isSuperAdmin}
              onChange={(e) => setF({ ...f, role: e.target.value as 'STAFF' })}
            >
              <option value="STAFF">{t('roles.STAFF')}</option>
              <option value="MANAGER">{t('roles.MANAGER')}</option>
            </Select>
          </FormField>
          <FormField id="s-type" label={t('type')}>
            <Select
              id="s-type"
              value={f.staffType}
              onChange={(e) => setF({ ...f, staffType: e.target.value as 'TEACHER' })}
            >
              {(['TEACHER', 'ASSISTANT', 'ADMIN'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`types.${v}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="s-join" label={t('joinDate')}>
            <Input
              id="s-join"
              type="date"
              value={f.joinDate}
              onChange={(e) => setF({ ...f, joinDate: e.target.value })}
            />
          </FormField>
          <FormField id="s-spec" label={t('specialties')} hint={t('specialtiesHint')}>
            <TagInput
              id="s-spec"
              value={f.specialties}
              onChange={(v) => setF({ ...f, specialties: v })}
              removeLabel={tc('remove')}
              suggestions={SPECIALTIES_AR}
            />
          </FormField>
          <FormField id="s-qual" label={t('qualification')} className="sm:col-span-2">
            <Textarea
              id="s-qual"
              value={f.qualification}
              onChange={(e) => setF({ ...f, qualification: e.target.value })}
            />
          </FormField>
          <FormField id="s-addr" label={t('address')} className="sm:col-span-2">
            <Input
              id="s-addr"
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
            />
          </FormField>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">{t('classes')}</legend>
            <div className="flex flex-wrap gap-2">
              {(classes.data ?? []).map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={f.classIds.includes(c.id)}
                    onChange={(e) => toggle('classIds', c.id, e.target.checked)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          {admin && f.role === 'STAFF' && (
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">{t('permissions')}</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {ALL_STAFF_PERMISSIONS.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={f.permissions.includes(p)}
                      onChange={(e) => toggle('permissions', p, e.target.checked)}
                    />
                    {t(`perm.${p}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
