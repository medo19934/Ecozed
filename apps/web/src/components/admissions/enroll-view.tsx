'use client';

import {
  CreateAdmissionSchema,
  localDate,
  type AdmissionDto,
  type BranchOption,
} from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusChip } from '@/components/ui/status-chip';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { useSession } from '@/lib/use-session';
import { ADMISSION_COLOR } from './admissions-view';

export function EnrollView() {
  const t = useTranslations('enroll');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const tk = useTranslations('children');
  const ts = useTranslations('status');
  const locale = useLocale();
  const fmt = useFormatDate();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const { data: user } = useSession();
  const branches = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<BranchOption[]>('/branches'),
  });
  const mine = useQuery({
    queryKey: ['admissions', 'mine'],
    queryFn: () => api.get<AdmissionDto[]>('/admissions/mine'),
  });
  const blank = {
    daycareId: '',
    childName: '',
    childGender: 'FEMALE',
    childBirthDate: '',
    guardianName: '',
    relationship: tk('relationships.mother'),
    phone: '',
    email: '',
    notes: '',
  };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (user)
      setF((x) => ({
        ...x,
        guardianName: x.guardianName || user.fullName,
        email: x.email || (user.email ?? ''),
        phone: x.phone || (user.phone ?? ''),
      }));
  }, [user]);
  useEffect(() => {
    if (branches.data?.[0]) setF((x) => ({ ...x, daycareId: x.daycareId || branches.data[0]!.id }));
  }, [branches.data]);

  const send = useMutation({
    mutationFn: (body: unknown) => api.post<AdmissionDto>('/admissions', body),
    onSuccess: () => {
      toast.success(t('sent'));
      void qc.invalidateQueries({ queryKey: ['admissions', 'mine'] });
      setF((x) => ({ ...x, childName: '', childBirthDate: '', notes: '' }));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api.delete(`/admissions/mine/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admissions', 'mine'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const branchName = (b: { name: string; nameEn: string | null }) =>
    (locale === 'en' && b.nameEn) || b.name;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        crumbs={[{ label: tn('home'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const body = validate(CreateAdmissionSchema, f);
                if (body) send.mutate(body);
              }}
            >
              <FormField id="e-branch" label={t('branch')} className="sm:col-span-2">
                <Select
                  id="e-branch"
                  value={f.daycareId}
                  onChange={(e) => set('daycareId', e.target.value)}
                >
                  {(branches.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {branchName(b)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="e-child"
                label={t('childName')}
                error={errors.childName}
                className="sm:col-span-2"
              >
                <Input
                  id="e-child"
                  value={f.childName}
                  onChange={(e) => set('childName', e.target.value)}
                  aria-invalid={!!errors.childName || undefined}
                />
              </FormField>
              <FormField id="e-gender" label={t('gender')}>
                <Select
                  id="e-gender"
                  value={f.childGender}
                  onChange={(e) => set('childGender', e.target.value)}
                >
                  <option value="FEMALE">{tk('genders.FEMALE')}</option>
                  <option value="MALE">{tk('genders.MALE')}</option>
                </Select>
              </FormField>
              <FormField id="e-birth" label={t('birthDate')} error={errors.childBirthDate}>
                <Input
                  id="e-birth"
                  type="date"
                  max={localDate()}
                  value={f.childBirthDate}
                  onChange={(e) => set('childBirthDate', e.target.value)}
                  aria-invalid={!!errors.childBirthDate || undefined}
                />
              </FormField>
              <FormField id="e-gname" label={t('guardianName')} error={errors.guardianName}>
                <Input
                  id="e-gname"
                  value={f.guardianName}
                  onChange={(e) => set('guardianName', e.target.value)}
                />
              </FormField>
              <FormField id="e-rel" label={t('relationship')} error={errors.relationship}>
                <Input
                  id="e-rel"
                  value={f.relationship}
                  onChange={(e) => set('relationship', e.target.value)}
                />
              </FormField>
              <FormField id="e-phone" label={t('phone')} error={errors.phone}>
                <Input
                  id="e-phone"
                  dir="ltr"
                  inputMode="tel"
                  placeholder="+9665XXXXXXXX"
                  value={f.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </FormField>
              <FormField id="e-email" label={t('email')} error={errors.email}>
                <Input
                  id="e-email"
                  type="email"
                  dir="ltr"
                  value={f.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </FormField>
              <FormField id="e-notes" label={t('notes')} className="sm:col-span-2">
                <Textarea
                  id="e-notes"
                  value={f.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </FormField>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="lg" disabled={send.isPending || !f.daycareId}>
                  <Send className="rtl:-scale-x-100" /> {t('submit')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <section className="space-y-3">
          <h2 className="font-semibold">{t('mine')}</h2>
          {!mine.data?.length ? (
            <p className="rounded-[20px] border border-dashed bg-card p-5 text-sm text-muted-foreground">
              {tc('none')}
            </p>
          ) : (
            <ul className="grid gap-3">
              {mine.data.map((a) => (
                <li key={a.id} className="grid gap-2 rounded-[20px] bg-card p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Baby className="size-4 text-primary" aria-hidden />
                      <span className="font-medium">{a.childName}</span>
                    </div>
                    <StatusChip color={ADMISSION_COLOR[a.status]}>
                      {ts(
                        a.status === 'UNDER_REVIEW'
                          ? 'PENDING'
                          : a.status === 'ACCEPTED'
                            ? 'APPROVED'
                            : 'REJECTED',
                      )}
                    </StatusChip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {branchName(a.branch)} · {fmt(a.createdAt)}
                  </p>
                  {a.rejectReason && (
                    <p className="rounded-xl bg-muted p-3 text-sm">
                      <span className="block text-xs text-muted-foreground">
                        {t('rejectReason')}
                      </span>
                      {a.rejectReason}
                    </p>
                  )}
                  {a.status === 'UNDER_REVIEW' && (
                    <Confirm
                      title={t('withdrawConfirm')}
                      confirmLabel={t('withdraw')}
                      destructive
                      onConfirm={() => withdraw.mutateAsync(a.id)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-self-start text-destructive"
                      >
                        <Trash2 /> {t('withdraw')}
                      </Button>
                    </Confirm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
