'use client';

import { ALL_STAFF_PERMISSIONS, type StaffDetail, type StaffPermission } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
} from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { isBranchAdmin, useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useSession } from '@/lib/use-session';
import { StaffFiles } from './staff-files';
import { StaffFormDialog } from './staff-form-dialog';

export function StaffProfile({ id }: { id: string }) {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const qc = useQueryClient();
  const fmt = useFormatDate();
  const errorMessage = useErrorMessage();
  const { data: me } = useSession();
  const canArchive = useCan('canArchiveAccounts');
  const key = ['staff', id];
  const staff = useQuery({ queryKey: key, queryFn: () => api.get<StaffDetail>(`/staff/${id}`) });
  const onSaved = (s: StaffDetail) => {
    qc.setQueryData(key, s);
    void qc.invalidateQueries({ queryKey: ['staff', 'list'] });
  };
  const perms = useMutation({
    mutationFn: (permissions: string[]) => api.patch<StaffDetail>(`/staff/${id}`, { permissions }),
    onSuccess: (s) => {
      onSaved(s);
      toast.success(tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) =>
      api.post<StaffDetail>(`/staff/${id}/${archived ? 'archive' : 'restore'}`),
    onSuccess: (s) => {
      onSaved(s);
      toast.success(tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = staff.data;
  const crumbs = [
    { label: tn('dashboard'), href: '/dashboard' },
    { label: t('title'), href: '/staff' },
    { label: s?.fullName ?? '…' },
  ];
  if (staff.isError) return <EmptyState icon={GraduationCap} title={errorMessage(staff.error)} />;

  const editablePerms = isBranchAdmin(me) && s?.role === 'STAFF' && s.userId !== me?.id;

  return (
    <>
      <PageHeader title={s?.fullName ?? ''} crumbs={crumbs} crumbsLabel={tn('breadcrumb')} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          {!s ? (
            <CardContent>
              <Skeleton className="h-80" />
            </CardContent>
          ) : (
            <CardContent className="grid gap-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar name={s.fullName} src={s.avatarUrl} className="size-24 text-xl" />
                <div className="space-y-1">
                  <h2 className="flex items-center justify-center gap-2 text-lg font-semibold">
                    {s.fullName} {s.isTest && <TestBadge />}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {s.role === 'MANAGER'
                      ? t('roles.MANAGER')
                      : s.staffType
                        ? t(`types.${s.staffType}`)
                        : ''}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {s.status === 'ARCHIVED' ? (
                    <StatusChip color="red">{tc('archived')}</StatusChip>
                  ) : s.pendingFirstLogin ? (
                    <StatusChip color="amber">{t('pending')}</StatusChip>
                  ) : (
                    <StatusChip color="green">{tc('active')}</StatusChip>
                  )}
                  {s.joinDate && (
                    <StatusChip color="gray">{t('joined', { date: fmt(s.joinDate) })}</StatusChip>
                  )}
                </div>
              </div>
              {s.specialties.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {s.specialties.map((sp) => (
                    <StatusChip key={sp} color="blue">
                      {sp}
                    </StatusChip>
                  ))}
                </div>
              )}
              <ul className="grid gap-3 border-t pt-4 text-sm">
                {s.email && (
                  <li className="flex items-center gap-3">
                    <Mail className="size-4 text-muted-foreground" aria-hidden />
                    <span dir="ltr" className="truncate">
                      {s.email}
                    </span>
                  </li>
                )}
                {s.phone && (
                  <li className="flex items-center gap-3">
                    <Phone className="size-4 text-muted-foreground" aria-hidden />
                    <span dir="ltr">{s.phone}</span>
                  </li>
                )}
                {s.address && (
                  <li className="flex items-center gap-3">
                    <MapPin className="size-4 text-muted-foreground" aria-hidden />
                    {s.address}
                  </li>
                )}
                {s.qualification && (
                  <li className="flex items-start gap-3">
                    <GraduationCap className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    {s.qualification}
                  </li>
                )}
                {s.classes.length > 0 && (
                  <li className="flex items-center gap-3">
                    <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                    {s.classes.map((c) => c.name).join('، ')}
                  </li>
                )}
              </ul>
              <div className="grid gap-2 border-t pt-4">
                <p className="text-sm font-medium">{t('permissions')}</p>
                {s.role === 'MANAGER' ? (
                  <p className="text-xs text-muted-foreground">{t('permissionsHint')}</p>
                ) : (
                  <ul className="grid gap-1">
                    {ALL_STAFF_PERMISSIONS.map((p) => {
                      const on = s.permissions.includes(p);
                      return (
                        <li key={p} className="flex items-center justify-between gap-3 text-sm">
                          <span>{t(`perm.${p}`)}</span>
                          <Switch
                            checked={on}
                            disabled={!editablePerms || perms.isPending}
                            aria-label={t(`perm.${p}`)}
                            onCheckedChange={(v) =>
                              perms.mutate(
                                v
                                  ? [...s.permissions, p]
                                  : s.permissions.filter((x) => x !== (p as StaffPermission)),
                              )
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <StaffFormDialog staff={s}>
                  <Button variant="outline" size="sm">
                    <Pencil /> {tc('edit')}
                  </Button>
                </StaffFormDialog>
                {canArchive &&
                  s.userId !== me?.id &&
                  (s.status === 'ARCHIVED' ? (
                    <Confirm
                      title={t('restoreConfirm')}
                      confirmLabel={tc('restore')}
                      onConfirm={() => archive.mutateAsync(false)}
                    >
                      <Button variant="ghost" size="sm">
                        <ArchiveRestore /> {tc('restore')}
                      </Button>
                    </Confirm>
                  ) : (
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
                  ))}
              </div>
            </CardContent>
          )}
        </Card>
        <Card className="h-fit">
          <CardContent>
            <Tabs defaultValue="files" className="grid gap-5">
              <TabsList className="justify-self-start">
                <TabsTrigger value="files">{t('filesTab')}</TabsTrigger>
                <TabsTrigger value="messages">{t('messagesTab')}</TabsTrigger>
              </TabsList>
              <TabsContent value="files">
                <StaffFiles membershipId={id} />
              </TabsContent>
              <TabsContent value="messages">
                <EmptyState icon={MessageSquare} title={t('messagesSoon')} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
