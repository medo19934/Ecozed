'use client';

import type { ChildListItem, Paginated } from '@latif/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Baby, Plus, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
import { useErrorMessage } from '@/lib/use-error-message';
import { useDeferredValue, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
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
import { useFormatAge } from '@/lib/format';
import { useClasses } from '@/lib/queries';
import { useCan } from '@/lib/use-can';
import { ChildAvatar } from './child-avatar';
import { ChildFormDialog } from './child-form-dialog';

export function ChildrenView() {
  const t = useTranslations('children');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const age = useFormatAge();
  const sp = useSearchParams();
  const canAdd = useCan('canAddChild');
  const classes = useClasses();
  const [search, setSearch] = useState('');
  const [classroomId, setClassroomId] = useState(sp.get('classroomId') ?? '');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const q = useDeferredValue(search);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: '20',
    status,
    ...(q ? { search: q } : {}),
    ...(classroomId ? { classroomId } : {}),
    ...(gender ? { gender } : {}),
  });
  const list = useQuery({
    queryKey: ['children', 'list', params.toString()],
    queryFn: () => api.get<Paginated<ChildListItem>>(`/children?${params}`),
    placeholderData: keepPreviousData,
  });
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  const filtered = Boolean(q || classroomId || gender || status !== 'ACTIVE');

  const add = canAdd && (
    <ChildFormDialog>
      <Button>
        <Plus /> {t('add')}
      </Button>
    </ChildFormDialog>
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
        <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_180px_140px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t('searchPlaceholder')}
              placeholder={t('searchPlaceholder')}
              className="ps-9"
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
            />
          </div>
          <Select
            aria-label={t('classFilter')}
            value={classroomId}
            onChange={(e) => reset(setClassroomId)(e.target.value)}
          >
            <option value="">
              {t('classFilter')}: {tc('all')}
            </option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('genderFilter')}
            value={gender}
            onChange={(e) => reset(setGender)(e.target.value)}
          >
            <option value="">
              {t('genderFilter')}: {tc('all')}
            </option>
            <option value="FEMALE">{t('genders.FEMALE')}</option>
            <option value="MALE">{t('genders.MALE')}</option>
          </Select>
          <Select
            aria-label={t('statusFilter')}
            value={status}
            onChange={(e) => reset(setStatus)(e.target.value)}
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
            icon={Baby}
            title={filtered ? tc('noResults') : t('emptyTitle')}
            body={filtered ? undefined : t('emptyBody')}
            action={!filtered ? add : undefined}
          />
        ) : (
          <>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>{t('fullName')}</Th>
                  <Th>{t('age')}</Th>
                  <Th>{t('class')}</Th>
                  <Th>{t('guardian')}</Th>
                  <Th>{tc('status')}</Th>
                </Tr>
              </THead>
              <TBody>
                {list.data.items.map((c) => (
                  <Tr
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/children/${c.id}`)}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <ChildAvatar
                          src={c.hasPhoto ? `/children/${c.id}/photo` : null}
                          name={c.fullName}
                          gender={c.gender}
                        />
                        <div>
                          <Link
                            href={`/children/${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 font-medium hover:text-primary"
                          >
                            {c.fullName} {c.isTest && <TestBadge />}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {t(`genders.${c.gender}`)}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{age(c.birthDate)}</Td>
                    <Td>
                      {c.classroom?.name ?? (
                        <span className="text-muted-foreground">{t('noClass')}</span>
                      )}
                    </Td>
                    <Td>
                      {c.primaryGuardian ? (
                        <div>
                          <p>
                            {c.primaryGuardian.fullName}{' '}
                            <span className="text-xs text-muted-foreground">
                              · {c.primaryGuardian.relationship}
                            </span>
                          </p>
                          {c.primaryGuardian.phone && (
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {c.primaryGuardian.phone}
                            </p>
                          )}
                        </div>
                      ) : (
                        tc('none')
                      )}
                    </Td>
                    <Td>
                      {c.status === 'ACTIVE' ? (
                        <StatusChip color="green">{tc('active')}</StatusChip>
                      ) : (
                        <StatusChip color="gray">{tc('archived')}</StatusChip>
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
