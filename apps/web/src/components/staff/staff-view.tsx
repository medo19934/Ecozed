'use client';

import type { Paginated, StaffListItem } from '@latif/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
import { useErrorMessage } from '@/lib/use-error-message';
import { useDeferredValue, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip, TestBadge } from '@/components/ui/status-chip';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { useFormatDate } from '@/lib/format';
import { StaffFormDialog } from './staff-form-dialog';

export function StaffView() {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const fmt = useFormatDate();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const q = useDeferredValue(search);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: '20',
    status,
    ...(q ? { search: q } : {}),
    ...(role ? { role } : {}),
  });
  const list = useQuery({
    queryKey: ['staff', 'list', params.toString()],
    queryFn: () => api.get<Paginated<StaffListItem>>(`/staff?${params}`),
    placeholderData: keepPreviousData,
  });

  const add = (
    <StaffFormDialog>
      <Button>
        <Plus /> {t('add')}
      </Button>
    </StaffFormDialog>
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
        actions={add}
      />
      <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={tc('search')}
              placeholder={tc('search')}
              className="ps-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label={t('role')}
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{tc('all')}</option>
            <option value="MANAGER">{t('roles.MANAGER')}</option>
            <option value="STAFF">{t('roles.STAFF')}</option>
          </Select>
          <Select
            aria-label={tc('status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="ACTIVE">{tc('active')}</option>
            <option value="ARCHIVED">{tc('archived')}</option>
          </Select>
        </div>
        {list.isLoading ? (
          <div className="grid gap-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : list.isError ? (
          <EmptyState icon={TriangleAlert} title={errorMessage(list.error)} />
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={Users}
            title={q || role || status !== 'ACTIVE' ? tc('noResults') : t('emptyTitle')}
            body={q ? undefined : t('emptyBody')}
          />
        ) : (
          <>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>{t('fullName')}</Th>
                  <Th>{t('type')}</Th>
                  <Th>{t('classes')}</Th>
                  <Th>{t('specialties')}</Th>
                  <Th>{t('joinDate')}</Th>
                  <Th>{tc('status')}</Th>
                </Tr>
              </THead>
              <TBody>
                {list.data.items.map((s) => (
                  <Tr
                    key={s.membershipId}
                    className="cursor-pointer"
                    onClick={() => router.push(`/staff/${s.membershipId}`)}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={s.fullName} src={s.avatarUrl} />
                        <div className="min-w-0">
                          <Link
                            href={`/staff/${s.membershipId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 font-medium hover:text-primary"
                          >
                            {s.fullName} {s.isTest && <TestBadge />}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground" dir="ltr">
                            {s.email}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        {s.staffType && <span>{t(`types.${s.staffType}`)}</span>}
                        {s.role === 'MANAGER' && (
                          <StatusChip color="blue">{t('roles.MANAGER')}</StatusChip>
                        )}
                      </div>
                    </Td>
                    <Td className="text-muted-foreground">
                      {s.classes.map((c) => c.name).join('، ') || tc('none')}
                    </Td>
                    <Td>
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {s.specialties.map((sp) => (
                          <StatusChip key={sp} color="gray">
                            {sp}
                          </StatusChip>
                        ))}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{fmt(s.joinDate)}</Td>
                    <Td>
                      {s.status === 'ARCHIVED' ? (
                        <StatusChip color="red">{tc('archived')}</StatusChip>
                      ) : s.pendingFirstLogin ? (
                        <StatusChip color="amber">{t('pending')}</StatusChip>
                      ) : (
                        <StatusChip color="green">{tc('active')}</StatusChip>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              total={list.data.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
