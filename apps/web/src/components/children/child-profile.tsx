'use client';

import type { ChildDetail } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Baby,
  Camera,
  HeartPulse,
  Link2,
  Pencil,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip, TestBadge } from '@/components/ui/status-chip';
import { api } from '@/lib/api-client';
import { useFormatAge, useFormatDate } from '@/lib/format';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { ChildAvatar } from './child-avatar';
import { ChildFormDialog } from './child-form-dialog';

export function ChildProfile({ id }: { id: string }) {
  const t = useTranslations('children');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const qc = useQueryClient();
  const age = useFormatAge();
  const fmt = useFormatDate();
  const errorMessage = useErrorMessage();
  const canEdit = useCan('canAddChild');
  const canArchive = useCan('canArchiveAccounts');
  const photoInput = useRef<HTMLInputElement>(null);
  const key = ['children', id];
  const child = useQuery({ queryKey: key, queryFn: () => api.get<ChildDetail>(`/children/${id}`) });
  const onSaved = (c: ChildDetail) => {
    qc.setQueryData(key, c);
    void qc.invalidateQueries({ queryKey: ['children', 'list'] });
    toast.success(tc('saved'));
  };
  const archive = useMutation({
    mutationFn: (archived: boolean) =>
      api.post<ChildDetail>(`/children/${id}/${archived ? 'archive' : 'restore'}`),
    onSuccess: onSaved,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const photo = useMutation({
    mutationFn: (file: File) => api.upload<ChildDetail>(`/children/${id}/photo`, file),
    onSuccess: onSaved,
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (child.isError) return <EmptyState icon={Baby} title={errorMessage(child.error)} />;
  const c = child.data;
  const crumbs = [
    { label: tn('dashboard'), href: '/dashboard' },
    { label: t('title'), href: '/children' },
    { label: c?.fullName ?? '…' },
  ];

  return (
    <>
      <PageHeader title={c?.fullName ?? ''} crumbs={crumbs} crumbsLabel={tn('breadcrumb')} />
      {!c ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardContent className="grid gap-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <ChildAvatar
                    src={
                      c.hasPhoto
                        ? `/children/${c.id}/photo?v=${encodeURIComponent(c.createdAt)}${photo.submittedAt}`
                        : null
                    }
                    name={c.fullName}
                    gender={c.gender}
                    className="size-28"
                  />
                  {canEdit && (
                    <>
                      <input
                        ref={photoInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) photo.mutate(f);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        size="icon-sm"
                        className="absolute -bottom-1 end-0 rounded-full"
                        aria-label={t('changePhoto')}
                        onClick={() => photoInput.current?.click()}
                      >
                        <Camera />
                      </Button>
                    </>
                  )}
                </div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  {c.fullName} {c.isTest && <TestBadge />}
                </h2>
                <div className="flex flex-wrap justify-center gap-2">
                  <StatusChip color={c.status === 'ACTIVE' ? 'green' : 'gray'}>
                    {c.status === 'ACTIVE' ? tc('active') : tc('archived')}
                  </StatusChip>
                  <StatusChip color="blue">{t(`genders.${c.gender}`)}</StatusChip>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t pt-4 text-sm">
                <dt className="text-muted-foreground">{t('age')}</dt>
                <dd>{age(c.birthDate)}</dd>
                <dt className="text-muted-foreground">{t('birthDate')}</dt>
                <dd>{fmt(c.birthDate)}</dd>
                <dt className="text-muted-foreground">{t('class')}</dt>
                <dd>{c.classroom?.name ?? t('noClass')}</dd>
              </dl>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {canEdit && (
                  <ChildFormDialog child={c}>
                    <Button variant="outline" size="sm">
                      <Pencil /> {tc('edit')}
                    </Button>
                  </ChildFormDialog>
                )}
                {canArchive &&
                  (c.status === 'ACTIVE' ? (
                    <Confirm
                      title={t('archiveConfirm')}
                      confirmLabel={tc('archive')}
                      destructive
                      onConfirm={() => archive.mutateAsync(true)}
                    >
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Archive /> {tc('archive')}
                      </Button>
                    </Confirm>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => archive.mutate(false)}>
                      <ArchiveRestore /> {tc('restore')}
                    </Button>
                  ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid h-fit gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-primary" aria-hidden /> {t('guardians')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {c.guardians.map((g) => (
                    <li key={g.id} className="grid gap-1.5 rounded-2xl border p-4 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        {g.fullName}{' '}
                        <span className="text-xs text-muted-foreground">· {g.relationship}</span>
                        {g.isPrimary && <StatusChip color="blue">{t('primary')}</StatusChip>}
                      </p>
                      {g.phone && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="size-3.5" aria-hidden />
                          <span dir="ltr">{g.phone}</span>
                        </p>
                      )}
                      {g.email && (
                        <p className="truncate text-muted-foreground" dir="ltr">
                          {g.email}
                        </p>
                      )}
                      <span className="mt-1">
                        {g.linked ? (
                          <StatusChip color="green">
                            <Link2 className="size-3" aria-hidden /> {t('linked')}
                          </StatusChip>
                        ) : (
                          <StatusChip color="amber">{t('notLinked')}</StatusChip>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HeartPulse className="size-5 text-destructive" aria-hidden /> {t('medical')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('allergies')}</p>
                    <p className={c.allergies ? 'font-medium text-destructive' : ''}>
                      {c.allergies ?? tc('none')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('medicalNotes')}</p>
                    <p className="whitespace-pre-line">{c.medicalNotes ?? tc('none')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-success" aria-hidden /> {t('pickup')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {c.pickupPeople.length ? (
                    <ul className="grid gap-2 text-sm">
                      {c.pickupPeople.map((p, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span>
                            {p.name}{' '}
                            {p.relationship && (
                              <span className="text-xs text-muted-foreground">
                                · {p.relationship}
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground" dir="ltr">
                            {p.phone}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tc('none')}</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <p className="rounded-[20px] border border-dashed p-5 text-sm text-muted-foreground">
              {t('comingSoonSections')}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
