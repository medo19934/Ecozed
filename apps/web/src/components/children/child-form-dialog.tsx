'use client';

import { ChildSchema, type ChildDetail } from '@latif/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useClasses } from '@/lib/queries';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';

type Guardian = {
  id?: string;
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
};
type Pickup = { name: string; relationship: string; phone: string };
const REL = ['mother', 'father', 'grandparent', 'sibling', 'other'] as const;

export function ChildFormDialog({ child, children }: { child?: ChildDetail; children: ReactNode }) {
  const t = useTranslations('children');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const classes = useClasses();
  const [open, setOpen] = useState(false);
  const rel = (k: (typeof REL)[number]) => t(`relationships.${k}`);
  const emptyGuardian = (): Guardian => ({
    fullName: '',
    relationship: rel('mother'),
    phone: '',
    email: '',
    isPrimary: false,
  });
  const blank = {
    fullName: '',
    gender: 'FEMALE' as 'MALE' | 'FEMALE',
    birthDate: '',
    classroomId: '',
    allergies: '',
    medicalNotes: '',
    guardians: [{ ...emptyGuardian(), isPrimary: true }] as Guardian[],
    pickupPeople: [] as Pickup[],
  };
  const [f, setF] = useState(blank);

  useEffect(() => {
    if (!open) return;
    setF(
      child
        ? {
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            classroomId: child.classroom?.id ?? '',
            allergies: child.allergies ?? '',
            medicalNotes: child.medicalNotes ?? '',
            guardians: child.guardians.map((g) => ({
              id: g.id,
              fullName: g.fullName,
              relationship: g.relationship,
              phone: g.phone ?? '',
              email: g.email ?? '',
              isPrimary: g.isPrimary,
            })),
            pickupPeople: child.pickupPeople,
          }
        : blank,
    );
  }, [open, child]);

  const save = useMutation({
    mutationFn: (body: unknown) =>
      child
        ? api.put<ChildDetail>(`/children/${child.id}`, body)
        : api.post<ChildDetail>('/children', body),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['children'] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
      qc.setQueryData(['children', c.id], c);
      toast.success(tc('saved'));
      setOpen(false);
      if (!child) router.push(`/children/${c.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = () => {
    const body = validate(ChildSchema, {
      ...f,
      classroomId: f.classroomId || null,
      guardians: f.guardians.map((g) => ({ ...g, ...(g.id ? {} : { id: undefined }) })),
    });
    if (body) save.mutate(body);
  };
  const setG = (i: number, patch: Partial<Guardian>) =>
    setF((x) => ({
      ...x,
      guardians: x.guardians.map((g, j) =>
        j === i ? { ...g, ...patch } : patch.isPrimary ? { ...g, isPrimary: false } : g,
      ),
    }));
  const setP = (i: number, patch: Partial<Pickup>) =>
    setF((x) => ({
      ...x,
      pickupPeople: x.pickupPeople.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={child ? t('edit') : t('add')}
        closeLabel={tc('close')}
        className="sm:max-w-2xl"
      >
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="k-name"
              label={t('fullName')}
              error={errors.fullName}
              className="sm:col-span-2"
            >
              <Input
                id="k-name"
                value={f.fullName}
                onChange={(e) => setF({ ...f, fullName: e.target.value })}
                aria-invalid={!!errors.fullName || undefined}
              />
            </FormField>
            <FormField id="k-gender" label={t('gender')}>
              <Select
                id="k-gender"
                value={f.gender}
                onChange={(e) => setF({ ...f, gender: e.target.value as 'MALE' })}
              >
                <option value="FEMALE">{t('genders.FEMALE')}</option>
                <option value="MALE">{t('genders.MALE')}</option>
              </Select>
            </FormField>
            <FormField id="k-birth" label={t('birthDate')} error={errors.birthDate}>
              <Input
                id="k-birth"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={f.birthDate}
                onChange={(e) => setF({ ...f, birthDate: e.target.value })}
                aria-invalid={!!errors.birthDate || undefined}
              />
            </FormField>
            <FormField id="k-class" label={t('class')} className="sm:col-span-2">
              <Select
                id="k-class"
                value={f.classroomId}
                onChange={(e) => setF({ ...f, classroomId: e.target.value })}
              >
                <option value="">{t('noClass')}</option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.childrenCount}/{c.capacity})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="k-allergies" label={t('allergies')}>
              <Textarea
                id="k-allergies"
                value={f.allergies}
                onChange={(e) => setF({ ...f, allergies: e.target.value })}
              />
            </FormField>
            <FormField id="k-medical" label={t('medicalNotes')}>
              <Textarea
                id="k-medical"
                value={f.medicalNotes}
                onChange={(e) => setF({ ...f, medicalNotes: e.target.value })}
              />
            </FormField>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-semibold">{t('guardians')}</legend>
            <p className="text-xs text-muted-foreground">{t('linkHint')}</p>
            {errors.guardians && (
              <p role="alert" className="text-xs text-destructive">
                {errors.guardians}
              </p>
            )}
            {f.guardians.map((g, i) => (
              <div key={g.id ?? i} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
                <FormField
                  id={`g-${i}-name`}
                  label={t('name')}
                  error={errors[`guardians.${i}.fullName`]}
                >
                  <Input
                    id={`g-${i}-name`}
                    value={g.fullName}
                    onChange={(e) => setG(i, { fullName: e.target.value })}
                  />
                </FormField>
                <FormField id={`g-${i}-rel`} label={t('relationship')}>
                  <Input
                    id={`g-${i}-rel`}
                    list="relationships"
                    value={g.relationship}
                    onChange={(e) => setG(i, { relationship: e.target.value })}
                  />
                </FormField>
                <FormField
                  id={`g-${i}-phone`}
                  label={t('phone')}
                  error={errors[`guardians.${i}.phone`]}
                >
                  <Input
                    id={`g-${i}-phone`}
                    dir="ltr"
                    inputMode="tel"
                    placeholder="+9665XXXXXXXX"
                    value={g.phone}
                    onChange={(e) => setG(i, { phone: e.target.value })}
                  />
                </FormField>
                <FormField
                  id={`g-${i}-email`}
                  label={t('email')}
                  error={errors[`guardians.${i}.email`]}
                >
                  <Input
                    id={`g-${i}-email`}
                    type="email"
                    dir="ltr"
                    placeholder="name@gmail.com"
                    value={g.email}
                    onChange={(e) => setG(i, { email: e.target.value })}
                  />
                </FormField>
                <div className="flex items-center justify-between sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="primary"
                      className="size-4 accent-[var(--primary)]"
                      checked={g.isPrimary}
                      onChange={() => setG(i, { isPrimary: true })}
                    />
                    {t('primary')}
                  </label>
                  {f.guardians.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setF({ ...f, guardians: f.guardians.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 /> {tc('remove')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <datalist id="relationships">
              {REL.map((r) => (
                <option key={r} value={rel(r)} />
              ))}
            </datalist>
            {f.guardians.length < 6 && (
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                onClick={() => setF({ ...f, guardians: [...f.guardians, emptyGuardian()] })}
              >
                <Plus /> {t('addGuardian')}
              </Button>
            )}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-semibold">{t('pickup')}</legend>
            {f.pickupPeople.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px_160px_auto]">
                <Input
                  aria-label={t('name')}
                  placeholder={t('name')}
                  value={p.name}
                  onChange={(e) => setP(i, { name: e.target.value })}
                />
                <Input
                  aria-label={t('relationship')}
                  placeholder={t('relationship')}
                  value={p.relationship}
                  onChange={(e) => setP(i, { relationship: e.target.value })}
                />
                <Input
                  aria-label={t('phone')}
                  dir="ltr"
                  placeholder="+9665…"
                  value={p.phone}
                  onChange={(e) => setP(i, { phone: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tc('remove')}
                  onClick={() =>
                    setF({ ...f, pickupPeople: f.pickupPeople.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                setF({
                  ...f,
                  pickupPeople: [...f.pickupPeople, { name: '', relationship: '', phone: '' }],
                })
              }
            >
              <Plus /> {t('addPickup')}
            </Button>
          </fieldset>

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
