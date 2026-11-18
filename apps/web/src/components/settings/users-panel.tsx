'use client';

import type {
  ChildListItem,
  ClassroomDto,
  IssuedPassword,
  ManagedRole,
  ManagedUser,
  Paginated,
  UserAuditEntry,
} from '@latif/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Link2,
  Pencil,
  Power,
  PowerOff,
  Search,
  Trash2,
  Unlink,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { IssuedPasswordDialog } from '@/components/auth/issued-password-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, TBody, THead, Td, Th, Tr } from '@/components/ui/table';
import { ApiError, api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { useSession } from '@/lib/use-session';

const KEY = ['users'] as const;
const ROLES: ManagedRole[] = ['MANAGER', 'STAFF', 'PARENT'];

interface Draft {
  role: ManagedRole;
  fullName: string;
  email: string;
  phone: string;
  daycareId: string;
  classIds: string[];
  children: { childId: string; relationship: string }[];
}

/** Classes and children of the active branch (pickers). */
function useBranchLists() {
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassroomDto[]>('/classes'),
  });
  const children = useQuery({
    queryKey: ['children', 'picker'],
    queryFn: () => api.get<Paginated<ChildListItem>>('/children?pageSize=100&status=ACTIVE'),
  });
  return { classes: classes.data ?? [], children: children.data?.items ?? [] };
}

function UserDialog({
  editing,
  onClose,
  onIssued,
}: {
  editing: ManagedUser | 'new';
  onClose: () => void;
  onIssued: (i: IssuedPassword) => void;
}) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { data: me } = useSession();
  const lists = useBranchLists();
  const isNew = editing === 'new';
  const [d, setD] = useState<Draft>(() =>
    isNew
      ? {
          role: 'STAFF',
          fullName: '',
          email: '',
          phone: '',
          daycareId: me?.daycareId ?? '',
          classIds: [],
          children: [],
        }
      : {
          role: editing.role,
          fullName: editing.fullName,
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          daycareId: editing.branch.id,
          classIds: editing.classes.map((c) => c.id),
          children: [],
        },
  );
  const [pick, setPick] = useState({ childId: '', relationship: '' });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const sameBranch = d.daycareId === me?.daycareId;
  const roles = me?.isSuperAdmin ? ROLES : ROLES.filter((r) => r !== 'MANAGER');

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? (api.post<{ user: ManagedUser; issued: IssuedPassword | null }>('/users', {
            role: d.role,
            fullName: d.fullName,
            email: d.email.trim() || undefined,
            phone: d.phone.trim() || undefined,
            daycareId: d.daycareId || undefined,
            classIds: d.role === 'STAFF' && sameBranch ? d.classIds : [],
            children: d.role === 'PARENT' && sameBranch ? d.children : [],
          }) as Promise<ManagedUser | { user: ManagedUser; issued: IssuedPassword | null }>)
        : (api.patch<ManagedUser>(`/users/${(editing as ManagedUser).membershipId}`, {
            fullName: d.fullName,
            phone: d.phone.trim() || null,
            role: d.role,
            daycareId: d.daycareId,
            ...(sameBranch ? { classIds: d.role === 'STAFF' ? d.classIds : [] } : {}),
          }) as Promise<ManagedUser | { user: ManagedUser; issued: IssuedPassword | null }>),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success(tc('saved'));
      if (isNew && 'issued' in r && r.issued) onIssued(r.issued);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        closeLabel={tc('close')}
        title={isNew ? t('add') : t('edit')}
        className="max-h-[90vh] overflow-y-auto"
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!d.fullName.trim()) return toast.error(t('nameRequired'));
            if (isNew && !d.email.trim() && !d.phone.trim())
              return toast.error(t('contactRequired'));
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="u-role" label={t('role')}>
              <Select
                id="u-role"
                value={d.role}
                onChange={(e) => set('role', e.target.value as ManagedRole)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="u-branch" label={t('branch')}>
              <Select
                id="u-branch"
                value={d.daycareId}
                disabled={!me?.isSuperAdmin}
                onChange={(e) => set('daycareId', e.target.value)}
              >
                {(me?.memberships ?? []).map((m) => (
                  <option key={m.daycareId} value={m.daycareId}>
                    {m.daycareName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="u-name" label={t('fullName')}>
              <Input
                id="u-name"
                value={d.fullName}
                onChange={(e) => set('fullName', e.target.value)}
              />
            </FormField>
            <FormField id="u-phone" label={t('phone')}>
              <Input
                id="u-phone"
                dir="ltr"
                placeholder="+9665XXXXXXXX"
                value={d.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </FormField>
            <FormField id="u-email" label={t('email')}>
              <Input
                id="u-email"
                dir="ltr"
                type="email"
                disabled={!isNew}
                value={d.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </FormField>
          </div>
          {d.role === 'STAFF' && sameBranch && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t('classes')}</legend>
              <div className="flex flex-wrap gap-2">
                {lists.classes.map((c) => {
                  const on = d.classIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          'classIds',
                          on ? d.classIds.filter((x) => x !== c.id) : [...d.classIds, c.id],
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {isNew && d.role === 'PARENT' && sameBranch && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t('children')}</legend>
              {d.children.map((c) => (
                <div
                  key={c.childId}
                  className="flex items-center gap-2 rounded-xl border p-2 text-sm"
                >
                  <span className="flex-1">
                    {lists.children.find((k) => k.id === c.childId)?.fullName} · {c.relationship}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('unlink')}
                    onClick={() =>
                      set(
                        'children',
                        d.children.filter((x) => x.childId !== c.childId),
                      )
                    }
                  >
                    <Unlink />
                  </Button>
                </div>
              ))}
              <ChildPicker
                children={lists.children.filter((k) => !d.children.some((c) => c.childId === k.id))}
                value={pick}
                onChange={setPick}
                onAdd={() => {
                  set('children', [
                    ...d.children,
                    { childId: pick.childId, relationship: pick.relationship || t('guardian') },
                  ]);
                  setPick({ childId: '', relationship: '' });
                }}
              />
            </fieldset>
          )}
          {isNew && <p className="text-sm text-muted-foreground">{t('tempHint')}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChildPicker({
  children,
  value,
  onChange,
  onAdd,
}: {
  children: ChildListItem[];
  value: { childId: string; relationship: string };
  onChange: (v: { childId: string; relationship: string }) => void;
  onAdd: () => void;
}) {
  const t = useTranslations('users');
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <FormField id="u-child" label={t('child')}>
        <Select
          id="u-child"
          value={value.childId}
          onChange={(e) => onChange({ ...value, childId: e.target.value })}
        >
          <option value="">{t('chooseChild')}</option>
          {children.map((k) => (
            <option key={k.id} value={k.id}>
              {k.fullName}
              {k.classroom ? ` · ${k.classroom.name}` : ''}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="u-rel" label={t('relationship')}>
        <Input
          id="u-rel"
          placeholder={t('relationshipHint')}
          value={value.relationship}
          onChange={(e) => onChange({ ...value, relationship: e.target.value })}
        />
      </FormField>
      <Button type="button" variant="outline" disabled={!value.childId} onClick={onAdd}>
        <Link2 /> {t('link')}
      </Button>
    </div>
  );
}

/** Parent: link / unlink children (second guardian, relationship) and move a child to a class. */
function ChildrenDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { data: me } = useSession();
  const lists = useBranchLists();
  const [current, setCurrent] = useState(user);
  const [pick, setPick] = useState({ childId: '', relationship: '' });
  const done = (u: ManagedUser) => {
    setCurrent(u);
    void qc.invalidateQueries({ queryKey: KEY });
    toast.success(tc('saved'));
  };
  const link = useMutation({
    mutationFn: () =>
      api.post<ManagedUser>(`/users/${user.membershipId}/children`, {
        childId: pick.childId,
        relationship: pick.relationship || t('guardian'),
      }),
    onSuccess: (u) => {
      setPick({ childId: '', relationship: '' });
      done(u);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unlink = useMutation({
    mutationFn: (childId: string) =>
      api.delete<ManagedUser>(`/users/${user.membershipId}/children/${childId}`),
    onSuccess: done,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const move = useMutation({
    mutationFn: (v: { childId: string; classroomId?: string; daycareId?: string }) =>
      api.post(`/users/children/${v.childId}/move`, {
        classroomId: v.classroomId,
        daycareId: v.daycareId,
      }),
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: ['children'] });
      done(await api.get<ManagedUser>(`/users/${user.membershipId}`));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sameBranch = user.branch.id === me?.daycareId;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        closeLabel={tc('close')}
        title={t('childrenOf', { name: user.fullName })}
        className="max-h-[90vh] overflow-y-auto"
      >
        <div className="grid gap-3">
          {current.children.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noChildren')}</p>
          )}
          {current.children.map((c) => (
            <div key={c.id} className="grid gap-2 rounded-2xl border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex-1 font-medium">
                  {c.fullName} · {c.relationship}
                  {c.classroom ? ` · ${c.classroom}` : ''}
                </span>
                <Confirm
                  title={t('unlink')}
                  body={t('unlinkHint', { child: c.fullName, name: user.fullName })}
                  confirmLabel={t('unlink')}
                  destructive
                  onConfirm={() => unlink.mutate(c.id)}
                >
                  <Button variant="ghost" size="icon" aria-label={t('unlink')}>
                    <Unlink />
                  </Button>
                </Confirm>
              </div>
              {sameBranch && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    aria-label={t('moveClass')}
                    value=""
                    onChange={(e) =>
                      e.target.value && move.mutate({ childId: c.id, classroomId: e.target.value })
                    }
                  >
                    <option value="">{t('moveClass')}</option>
                    {lists.classes.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </Select>
                  {me?.isSuperAdmin && (
                    <Select
                      aria-label={t('moveBranch')}
                      value=""
                      onChange={(e) =>
                        e.target.value && move.mutate({ childId: c.id, daycareId: e.target.value })
                      }
                    >
                      <option value="">{t('moveBranch')}</option>
                      {me.memberships
                        .filter((m) => m.daycareId !== user.branch.id)
                        .map((m) => (
                          <option key={m.daycareId} value={m.daycareId}>
                            {m.daycareName}
                          </option>
                        ))}
                    </Select>
                  )}
                </div>
              )}
            </div>
          ))}
          {sameBranch && (
            <ChildPicker
              children={lists.children.filter((k) => !current.children.some((c) => c.id === k.id))}
              value={pick}
              onChange={setPick}
              onAdd={() => link.mutate()}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Super admin: who added, edited, deactivated, deleted or reset whom — and when. */
function AuditList() {
  const t = useTranslations('users');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [...KEY, 'audit', page],
    queryFn: () => api.get<Paginated<UserAuditEntry>>(`/users/audit?page=${page}&pageSize=20`),
    placeholderData: keepPreviousData,
  });
  return (
    <Card className="grid gap-2 p-5">
      <h2 className="font-semibold">{t('auditTitle')}</h2>
      {q.isPending ? (
        <Skeleton className="h-24" />
      ) : q.data!.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('auditEmpty')}</p>
      ) : (
        <>
          <ul className="grid gap-1 text-sm">
            {q.data!.items.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 border-b py-2 last:border-0">
                <span className="font-medium">{a.actor ?? '—'}</span>
                <span>
                  {t.has(`actions.${a.action}` as never)
                    ? t(`actions.${a.action}` as never)
                    : a.action}
                </span>
                <span className="font-medium">{a.target ?? ''}</span>
                {a.branch && <span className="text-muted-foreground">· {a.branch}</span>}
                <time className="ms-auto text-muted-foreground" dir="ltr">
                  {new Date(a.at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
          {q.data!.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={q.data!.totalPages}
              total={q.data!.total}
              onPage={setPage}
            />
          )}
        </>
      )}
    </Card>
  );
}

/** Settings > Users: search, filter, add, edit, deactivate, delete, reset password, link children. */
export function UsersPanel() {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { data: me } = useSession();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManagedUser | 'new' | null>(null);
  const [kids, setKids] = useState<ManagedUser | null>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [blocked, setBlocked] = useState<ManagedUser | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search.trim()) params.set('search', search.trim());
  if (role) params.set('role', role);
  if (branch) params.set('daycareId', branch);
  if (status) params.set('status', status);
  const list = useQuery({
    queryKey: [...KEY, params.toString()],
    queryFn: () => api.get<Paginated<ManagedUser>>(`/users?${params}`),
    placeholderData: keepPreviousData,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: KEY });
  const act = useMutation({
    mutationFn: ({
      u,
      action,
    }: {
      u: ManagedUser;
      action: 'deactivate' | 'reactivate' | 'delete' | 'password';
    }) =>
      action === 'delete'
        ? api.delete(`/users/${u.membershipId}`)
        : api.post<IssuedPassword | ManagedUser>(`/users/${u.membershipId}/${action}`),
    onSuccess: (r, v) => {
      refresh();
      if (v.action === 'password') setIssued(r as IssuedPassword);
      else toast.success(tc('saved'));
    },
    onError: (e, v) => {
      if (e instanceof ApiError && e.code === 'has_records') setBlocked(v.u);
      else toast.error(errorMessage(e));
    },
  });
  const roles = me?.isSuperAdmin ? ROLES : ROLES.filter((r) => r !== 'MANAGER');
  const filter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="grid gap-5">
      <IssuedPasswordDialog issued={issued} onClose={() => setIssued(null)} />
      {editing && (
        <UserDialog editing={editing} onClose={() => setEditing(null)} onIssued={setIssued} />
      )}
      {kids && <ChildrenDialog user={kids} onClose={() => setKids(null)} />}
      {blocked && (
        <Dialog open onOpenChange={(o) => !o && setBlocked(null)}>
          <DialogContent
            closeLabel={tc('close')}
            title={t('cannotDelete')}
            description={t('cannotDeleteHint', { name: blocked.fullName })}
          >
            <DialogFooter>
              <Button variant="outline" onClick={() => setBlocked(null)}>
                {tc('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  act.mutate({ u: blocked, action: 'deactivate' });
                  setBlocked(null);
                }}
              >
                <PowerOff /> {t('deactivate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{t('title')}</h2>
            <p className="text-sm text-muted-foreground">
              {me?.isSuperAdmin ? t('hintSuper') : t('hintManager')}
            </p>
          </div>
          <Button onClick={() => setEditing('new')}>
            <UserPlus /> {t('add')}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t('search')}
              placeholder={t('search')}
              className="ps-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select aria-label={t('role')} value={role} onChange={filter(setRole)}>
            <option value="">{t('allRoles')}</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </Select>
          {me?.isSuperAdmin && (
            <Select aria-label={t('branch')} value={branch} onChange={filter(setBranch)}>
              <option value="">{t('allBranches')}</option>
              {me.memberships.map((m) => (
                <option key={m.daycareId} value={m.daycareId}>
                  {m.daycareName}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label={t('status')} value={status} onChange={filter(setStatus)}>
            <option value="">{t('allStatuses')}</option>
            <option value="ACTIVE">{t('statuses.ACTIVE')}</option>
            <option value="DISABLED">{t('statuses.DISABLED')}</option>
          </Select>
        </div>
      </Card>
      <Card className="overflow-x-auto p-0">
        {list.isPending ? (
          <Skeleton className="m-5 h-40" />
        ) : list.data!.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>{t('fullName')}</Th>
                <Th>{t('role')}</Th>
                <Th>{t('branch')}</Th>
                <Th>{t('details')}</Th>
                <Th>{t('status')}</Th>
                <Th>
                  <span className="sr-only">{t('actionsCol')}</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {list.data!.items.map((u) => {
                const self = u.userId === me?.id;
                return (
                  <Tr key={u.membershipId}>
                    <Td>
                      <p className="font-medium">{u.fullName}</p>
                      <p dir="ltr" className="text-start text-xs text-muted-foreground">
                        {u.email ?? u.phone}
                      </p>
                    </Td>
                    <Td>{t(`roles.${u.role}`)}</Td>
                    <Td>{u.branch.name}</Td>
                    <Td className="max-w-64 text-sm text-muted-foreground">
                      {u.role === 'PARENT'
                        ? u.children.map((c) => c.fullName).join('، ') || t('noChildren')
                        : u.classes.map((c) => c.name).join('، ')}
                    </Td>
                    <Td>
                      <StatusChip color={u.status === 'ACTIVE' ? 'green' : 'gray'}>
                        {t(`statuses.${u.status}`)}
                      </StatusChip>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('edit')}
                          title={t('edit')}
                          onClick={() => setEditing(u)}
                        >
                          <Pencil />
                        </Button>
                        {u.role === 'PARENT' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('children')}
                            title={t('children')}
                            onClick={() => setKids(u)}
                          >
                            <Link2 />
                          </Button>
                        )}
                        <Confirm
                          title={t('resetTitle')}
                          body={t('resetHint', { name: u.fullName })}
                          confirmLabel={t('reset')}
                          onConfirm={() => act.mutate({ u, action: 'password' })}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('reset')}
                            title={t('reset')}
                          >
                            <KeyRound />
                          </Button>
                        </Confirm>
                        {!self &&
                          (u.status === 'ACTIVE' ? (
                            <Confirm
                              title={t('deactivate')}
                              body={t('deactivateHint', { name: u.fullName })}
                              confirmLabel={t('deactivate')}
                              destructive
                              onConfirm={() => act.mutate({ u, action: 'deactivate' })}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('deactivate')}
                                title={t('deactivate')}
                              >
                                <PowerOff />
                              </Button>
                            </Confirm>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t('reactivate')}
                              title={t('reactivate')}
                              onClick={() => act.mutate({ u, action: 'reactivate' })}
                            >
                              <Power />
                            </Button>
                          ))}
                        {!self && (
                          <Confirm
                            title={t('deleteTitle')}
                            body={t('deleteHint', { name: u.fullName })}
                            confirmLabel={tc('delete')}
                            destructive
                            onConfirm={() => act.mutate({ u, action: 'delete' })}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={tc('delete')}
                              title={tc('delete')}
                            >
                              <Trash2 />
                            </Button>
                          </Confirm>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
        {list.data && list.data.totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={list.data.totalPages}
            total={list.data.total}
            onPage={setPage}
          />
        )}
      </Card>
      {me?.isSuperAdmin && <AuditList />}
    </div>
  );
}
