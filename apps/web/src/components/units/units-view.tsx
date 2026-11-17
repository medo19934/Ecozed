'use client';

import { UnitItemSchema, UnitSchema, type UnitDto, type UnitsResponse } from '@latif/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  ChevronDown,
  Layers,
  Pencil,
  Plus,
  Search,
  Shapes,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip, TestBadge } from '@/components/ui/status-chip';
import { TagInput } from '@/components/ui/tag-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { cn } from '@/lib/utils';

const COLORS = ['#5b6db4', '#7b649b', '#2fb36d', '#f2a33a', '#e5484d', '#0ea5e9'];

function UnitFormDialog({ unit, children }: { unit?: UnitDto; children: ReactNode }) {
  const t = useTranslations('units');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const [open, setOpen] = useState(false);
  const blank = {
    name: '',
    description: '',
    goals: [] as string[],
    color: COLORS[0]!,
    startDate: '',
    minAgeMonths: '',
    maxAgeMonths: '',
  };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(
      unit
        ? {
            name: unit.name,
            description: unit.description ?? '',
            goals: unit.goals,
            color: unit.color ?? COLORS[0]!,
            startDate: unit.startDate ?? '',
            minAgeMonths: unit.minAgeMonths?.toString() ?? '',
            maxAgeMonths: unit.maxAgeMonths?.toString() ?? '',
          }
        : blank,
    );
  }, [open, unit]);
  const save = useMutation({
    mutationFn: (body: unknown) =>
      unit ? api.put(`/units/${unit.id}`, body) : api.post('/units', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['units'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(tc('saved'));
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const num = (v: string) => (v.trim() ? Number(v) : null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={unit ? t('edit') : t('add')} closeLabel={tc('close')}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const body = validate(UnitSchema, {
              ...f,
              startDate: f.startDate || null,
              minAgeMonths: num(f.minAgeMonths),
              maxAgeMonths: num(f.maxAgeMonths),
            });
            if (body) save.mutate(body);
          }}
        >
          <FormField id="u-name" label={t('name')} error={errors.name}>
            <Input
              id="u-name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              aria-invalid={!!errors.name || undefined}
            />
          </FormField>
          <FormField id="u-desc" label={t('description')}>
            <Textarea
              id="u-desc"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </FormField>
          <FormField id="u-goals" label={t('goals')} hint={t('goalsHint')}>
            <TagInput
              id="u-goals"
              value={f.goals}
              onChange={(goals) => setF({ ...f, goals })}
              removeLabel={tc('remove')}
            />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField id="u-start" label={t('startDate')}>
              <Input
                id="u-start"
                type="date"
                value={f.startDate}
                onChange={(e) => setF({ ...f, startDate: e.target.value })}
              />
            </FormField>
            <FormField id="u-min" label={t('minAge')} error={errors.minAgeMonths}>
              <Input
                id="u-min"
                type="number"
                min={0}
                dir="ltr"
                value={f.minAgeMonths}
                onChange={(e) => setF({ ...f, minAgeMonths: e.target.value })}
              />
            </FormField>
            <FormField id="u-max" label={t('maxAge')} error={errors.maxAgeMonths}>
              <Input
                id="u-max"
                type="number"
                min={0}
                dir="ltr"
                value={f.maxAgeMonths}
                onChange={(e) => setF({ ...f, maxAgeMonths: e.target.value })}
              />
            </FormField>
          </div>
          <fieldset>
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

function ItemList({
  unit,
  kind,
  canManage,
}: {
  unit: UnitDto;
  kind: 'LESSON' | 'ACTIVITY';
  canManage: boolean;
}) {
  const t = useTranslations('units');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState('');
  const items = unit.items.filter((i) => i.kind === kind);
  const done = () => void qc.invalidateQueries({ queryKey: ['units'] });
  const add = useMutation({
    mutationFn: () => {
      const body = UnitItemSchema.parse({ kind, title });
      return api.post(`/units/${unit.id}/items`, body);
    },
    onSuccess: () => {
      setTitle('');
      done();
    },
    onError: (e) =>
      toast.error(e instanceof Error && !('status' in e) ? tc('required') : errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/units/${unit.id}/items/${id}`),
    onSuccess: done,
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="grid gap-2">
      {items.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{t('noItems')}</p>
      ) : (
        <ol className="grid gap-1.5">
          {items.map((i, n) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{n + 1}</span>
                {i.title}
              </span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${tc('delete')} ${i.title}`}
                  onClick={() => del.mutate(i.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
      {canManage && unit.status === 'ACTIVE' && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim().length >= 2) add.mutate();
          }}
        >
          <Input
            aria-label={t('itemTitle')}
            placeholder={t('itemTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9"
          />
          <Button type="submit" size="sm" disabled={add.isPending || title.trim().length < 2}>
            <Plus /> {kind === 'LESSON' ? t('addLesson') : t('addActivity')}
          </Button>
        </form>
      )}
    </div>
  );
}

function UnitRow({ unit, canManage }: { unit: UnitDto; canManage: boolean }) {
  const t = useTranslations('units');
  const tc = useTranslations('common');
  const fmt = useFormatDate();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const archive = useMutation({
    mutationFn: () =>
      api.post(`/units/${unit.id}/${unit.status === 'ACTIVE' ? 'archive' : 'restore'}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['units'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <li className="overflow-hidden rounded-[20px] border bg-card shadow-soft">
      <div
        className="flex flex-wrap items-center gap-3 p-4"
        style={{ borderInlineStart: `4px solid ${unit.color ?? 'var(--primary)'}` }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          <ChevronDown
            className={cn('size-5 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold">
              <BookOpen className="size-4 text-primary" aria-hidden />
              {unit.name} {unit.isTest && <TestBadge />}
            </span>
            <span className="block text-xs text-muted-foreground">
              {[
                unit.startDate && fmt(unit.startDate),
                unit.minAgeMonths != null && unit.maxAgeMonths != null
                  ? `${unit.minAgeMonths}–${unit.maxAgeMonths}`
                  : t('anyAge'),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip color="blue">{t('lessonsCount', { n: unit.lessons })}</StatusChip>
          <StatusChip color="green">{t('activitiesCount', { n: unit.activities })}</StatusChip>
          <StatusChip color="gray">{t('goalsCount', { n: unit.goals.length })}</StatusChip>
          {canManage && (
            <>
              <UnitFormDialog unit={unit}>
                <Button variant="ghost" size="icon-sm" aria-label={`${tc('edit')} ${unit.name}`}>
                  <Pencil />
                </Button>
              </UnitFormDialog>
              {unit.status === 'ACTIVE' ? (
                <Confirm
                  title={t('archiveConfirm')}
                  confirmLabel={tc('archive')}
                  onConfirm={() => archive.mutateAsync()}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${tc('archive')} ${unit.name}`}
                  >
                    <Archive />
                  </Button>
                </Confirm>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${tc('restore')} ${unit.name}`}
                  onClick={() => archive.mutate()}
                >
                  <ArchiveRestore />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="grid gap-4 border-t p-4">
          {unit.description && <p className="text-sm text-muted-foreground">{unit.description}</p>}
          {unit.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {unit.goals.map((g) => (
                <StatusChip key={g} color="gray">
                  {g}
                </StatusChip>
              ))}
            </div>
          )}
          <Tabs defaultValue="LESSON" className="grid gap-3">
            <TabsList className="justify-self-start">
              <TabsTrigger value="LESSON">{t('lessons')}</TabsTrigger>
              <TabsTrigger value="ACTIVITY">{t('activities')}</TabsTrigger>
            </TabsList>
            <TabsContent value="LESSON">
              <ItemList unit={unit} kind="LESSON" canManage={canManage} />
            </TabsContent>
            <TabsContent value="ACTIVITY">
              <ItemList unit={unit} kind="ACTIVITY" canManage={canManage} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </li>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  tint: string;
}) {
  return (
    <Card className="relative gap-2 overflow-hidden px-5 py-5">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ background: `linear-gradient(135deg, ${tint}, transparent 70%)` }}
        aria-hidden
      />
      <span
        className="relative flex size-10 items-center justify-center rounded-xl"
        style={{ background: `${tint}1f`, color: tint }}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="relative text-3xl font-bold">{value ?? '—'}</p>
      <p className="relative text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}

export function UnitsView() {
  const t = useTranslations('units');
  const tn = useTranslations('nav');
  const errorMessage = useErrorMessage();
  const canManage = useCan('canManageCurriculum');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search);
  const units = useQuery({
    queryKey: ['units', status, q],
    queryFn: () =>
      api.get<UnitsResponse>(
        `/units?status=${status}${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });
  const d = units.data;
  const add = canManage && (
    <UnitFormDialog>
      <Button>
        <Plus /> {t('add')}
      </Button>
    </UnitFormDialog>
  );
  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
        actions={add}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-6">
          <div className="grid grid-cols-3 gap-4">
            <Stat icon={Layers} label={t('cards.total')} value={d?.counts.total} tint="#5b6db4" />
            <Stat
              icon={BookOpen}
              label={t('cards.active')}
              value={d?.counts.active}
              tint="#2fb36d"
            />
            <Stat
              icon={Archive}
              label={t('cards.archived')}
              value={d?.counts.archived}
              tint="#7b649b"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={status} onValueChange={(v) => setStatus(v as 'ACTIVE')}>
              <TabsList>
                <TabsTrigger value="ACTIVE">{t('active')}</TabsTrigger>
                <TabsTrigger value="ARCHIVED">{t('archived')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={t('searchPlaceholder')}
                placeholder={t('searchPlaceholder')}
                className="ps-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {units.isLoading ? (
            <div className="grid gap-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : units.isError ? (
            <EmptyState icon={Shapes} title={errorMessage(units.error)} />
          ) : !d?.items.length ? (
            <Card>
              <EmptyState
                icon={Shapes}
                title={status === 'ACTIVE' ? t('empty') : t('emptyArchived')}
                action={status === 'ACTIVE' ? add : undefined}
              />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {d.items.map((u) => (
                <UnitRow key={u.id} unit={u} canManage={canManage} />
              ))}
            </ul>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t('teachers')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!d?.teachers.length ? (
              <p className="text-sm text-muted-foreground">{t('noTeachers')}</p>
            ) : (
              <ul className="grid gap-3">
                {d.teachers.map((tch) => (
                  <li key={tch.membershipId} className="flex items-center gap-3">
                    <Avatar name={tch.fullName} src={tch.avatarUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tch.fullName}</p>
                      <div className="flex flex-wrap gap-1">
                        {tch.specialties.map((s) => (
                          <StatusChip key={s} color="green" className="px-2 text-[10px]">
                            {s}
                          </StatusChip>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
