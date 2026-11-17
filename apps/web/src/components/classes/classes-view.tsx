'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, School, Trash2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip, TestBadge } from '@/components/ui/status-chip';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useClasses } from '@/lib/queries';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';
import { ClassFormDialog } from './class-form-dialog';

export function ClassesView() {
  const t = useTranslations('classes');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const canManage = useCan('canManageClasses');
  const { data, isLoading } = useClasses();
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(tc('deleted'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const addButton = canManage && (
    <ClassFormDialog>
      <Button>
        <Plus /> {t('add')}
      </Button>
    </ClassFormDialog>
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
        actions={addButton}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={School}
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={addButton}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => {
            const pct = Math.min(100, Math.round((c.childrenCount / c.capacity) * 100));
            const full = c.childrenCount >= c.capacity;
            return (
              <Card key={c.id} className="gap-4 overflow-hidden pt-0">
                <div className="h-2" style={{ background: c.color ?? 'var(--primary)' }} />
                <CardContent className="grid gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h2 className="flex items-center gap-2 text-lg font-semibold">
                        {c.name} {c.isTest && <TestBadge />}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {c.minAgeMonths != null && c.maxAgeMonths != null
                          ? t('ageMonths', { min: c.minAgeMonths, max: c.maxAgeMonths })
                          : t('anyAge')}
                      </p>
                    </div>
                    {full && <StatusChip color="red">{t('full')}</StatusChip>}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <Link
                        href={`/children?classroomId=${c.id}`}
                        className="flex items-center gap-1.5 hover:text-primary"
                      >
                        <Users className="size-4" aria-hidden />
                        {t('children', { count: c.childrenCount, capacity: c.capacity })}
                      </Link>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          full ? 'bg-destructive' : 'bg-brand-gradient',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {c.teachers.length ? (
                      <ul
                        className="flex -space-x-2 rtl:space-x-reverse"
                        aria-label={t('teachers')}
                      >
                        {c.teachers.map((tch) => (
                          <li key={tch.membershipId} title={tch.fullName}>
                            <Avatar
                              name={tch.fullName}
                              src={tch.avatarUrl}
                              className="size-8 ring-2 ring-card"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('noTeachers')}</span>
                    )}
                    {canManage && (
                      <div className="flex gap-1">
                        <ClassFormDialog classroom={c}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${tc('edit')} ${c.name}`}
                          >
                            <Pencil />
                          </Button>
                        </ClassFormDialog>
                        <Confirm
                          title={t('deleteConfirm')}
                          confirmLabel={tc('delete')}
                          destructive
                          onConfirm={() => remove.mutateAsync(c.id)}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${tc('delete')} ${c.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </Confirm>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
