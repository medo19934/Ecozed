'use client';

import { CLOSED_WEEKDAYS, localDate, type CalendarEventDto } from '@latif/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Plus,
  School,
  Trash2,
  User,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api-client';
import { addDays, addMonths, dow, monthStart, parseIso, range, weekStart } from '@/lib/dates';
import { useClasses } from '@/lib/queries';
import { useCan } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';
import { EventFormDialog, TYPES } from './event-form-dialog';

export const TYPE_COLOR: Record<CalendarEventDto['type'], string> = {
  LESSON: '#5b6db4',
  ACTIVITY: '#2fb36d',
  EVENT: '#7b649b',
  HOLIDAY: '#e5484d',
  MEETING: '#f2a33a',
  TRIP: '#0ea5e9',
};
type View = 'month' | 'week' | 'day';
const isClosed = (iso: string) => CLOSED_WEEKDAYS.includes(dow(iso));
const occurs = (e: CalendarEventDto, iso: string) => e.startDate <= iso && e.endDate >= iso;

function Chip({ e, onClick }: { e: CalendarEventDto; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={e.title}
      className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-start text-[11px] font-medium"
      style={{ background: `${TYPE_COLOR[e.type]}1f`, color: TYPE_COLOR[e.type] }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: TYPE_COLOR[e.type] }}
        aria-hidden
      />
      {e.startTime && (
        <span dir="ltr" className="shrink-0 opacity-80">
          {e.startTime}
        </span>
      )}
      <span className="truncate">{e.title}</span>
    </button>
  );
}

function EventDetails({
  e,
  onClose,
  onEdit,
}: {
  e: CalendarEventDto | null;
  onClose: () => void;
  onEdit: (e: CalendarEventDto) => void;
}) {
  const t = useTranslations('calendar');
  const tc = useTranslations('common');
  const f = useFormatter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(tc('deleted'));
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const day = (iso: string) => f.dateTime(parseIso(iso), { dateStyle: 'full', timeZone: 'UTC' });
  return (
    <Dialog open={!!e} onOpenChange={(o) => !o && onClose()}>
      {e && (
        <DialogContent title={e.title} closeLabel={tc('close')}>
          <div className="grid gap-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusChip color="gray">
                <span
                  className="size-2 rounded-full"
                  style={{ background: TYPE_COLOR[e.type] }}
                  aria-hidden
                />
                {t(`types.${e.type}`)}
              </StatusChip>
              <StatusChip color="blue">{t(`audiences.${e.audience}`)}</StatusChip>
            </div>
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              {day(e.startDate)}
              {e.endDate !== e.startDate && ` – ${day(e.endDate)}`}
              {e.startTime && (
                <span dir="ltr">
                  · {e.startTime}
                  {e.endTime && ` – ${e.endTime}`}
                </span>
              )}
            </p>
            {e.branch && (
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                {e.branch.name}
              </p>
            )}
            {e.classroom && (
              <p className="flex items-center gap-2">
                <School className="size-4 text-muted-foreground" aria-hidden />
                {e.classroom.name}
              </p>
            )}
            {e.unit && (
              <p className="flex items-center gap-2">
                <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                {e.unit.name}
              </p>
            )}
            {e.teacher && (
              <p className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" aria-hidden />
                {e.teacher.fullName}
              </p>
            )}
            {e.description && (
              <p className="whitespace-pre-line rounded-xl bg-muted/60 p-3">{e.description}</p>
            )}
            {e.canEdit && (
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => onEdit(e)}>
                  <Pencil /> {tc('edit')}
                </Button>
                <Confirm
                  title={t('deleteConfirm')}
                  confirmLabel={tc('delete')}
                  destructive
                  onConfirm={() => del.mutateAsync(e.id)}
                >
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 /> {tc('delete')}
                  </Button>
                </Confirm>
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function CalendarView() {
  const t = useTranslations('calendar');
  const tn = useTranslations('nav');
  const tw = useTranslations('weekdays');
  const f = useFormatter();
  const { data: user } = useSession();
  const canManage = useCan('canManageCurriculum') || Boolean(user?.isSuperAdmin);
  const isParent = user?.role === 'PARENT';
  const classes = useClasses(Boolean(user) && !isParent);
  const today = localDate();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(today);
  const [classroomId, setClassroomId] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<CalendarEventDto | null>(null);
  const [editing, setEditing] = useState<CalendarEventDto | null>(null);

  const from =
    view === 'month' ? weekStart(monthStart(cursor)) : view === 'week' ? weekStart(cursor) : cursor;
  const days = view === 'month' ? range(from, 42) : view === 'week' ? range(from, 7) : [cursor];
  const to = days[days.length - 1]!;
  const params = new URLSearchParams({
    from,
    to,
    ...(classroomId ? { classroomId } : {}),
    ...(type ? { type } : {}),
  });
  const events = useQuery({
    queryKey: ['calendar', params.toString()],
    queryFn: () => api.get<CalendarEventDto[]>(`/calendar?${params}`),
    placeholderData: keepPreviousData,
  });
  const list = events.data ?? [];
  const on = (iso: string) => list.filter((e) => occurs(e, iso));

  const move = (n: number) =>
    setCursor((c) =>
      view === 'month' ? addMonths(c, n) : view === 'week' ? addDays(c, 7 * n) : addDays(c, n),
    );
  const title =
    view === 'month'
      ? f.dateTime(parseIso(cursor), { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : view === 'week'
        ? `${f.dateTime(parseIso(from), { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${f.dateTime(parseIso(to), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
        : f.dateTime(parseIso(cursor), { dateStyle: 'full', timeZone: 'UTC' });
  const weekdayHeads = range(weekStart(today), 7);
  const openDay = (iso: string) => {
    setCursor(iso);
    setView('day');
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[
          { label: isParent ? tn('home') : tn('dashboard'), href: '/dashboard' },
          { label: t('title') },
        ]}
        crumbsLabel={tn('breadcrumb')}
        actions={
          canManage && (
            <EventFormDialog defaultDate={view === 'month' ? today : cursor}>
              <Button>
                <Plus /> {t('add')}
              </Button>
            </EventFormDialog>
          )
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(today)}>
              {t('today')}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('prev')} onClick={() => move(-1)}>
              <ChevronRight className="ltr:rotate-180" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('next')} onClick={() => move(1)}>
              <ChevronLeft className="ltr:rotate-180" />
            </Button>
            <h2 className="text-lg font-semibold" aria-live="polite">
              {title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isParent && (
              <Select
                aria-label={t('class')}
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="h-9 w-40"
              >
                <option value="">{t('allClasses')}</option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <Select
              aria-label={t('type')}
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 w-36"
            >
              <option value="">{t('allTypes')}</option>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`types.${x}`)}
                </option>
              ))}
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList>
                {(['month', 'week', 'day'] as const).map((v) => (
                  <TabsTrigger key={v} value={v}>
                    {t(`views.${v}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {events.isLoading ? (
          <Skeleton className="m-4 h-96" />
        ) : view === 'day' ? (
          <div className="grid gap-2 p-4">
            {isClosed(cursor) && (
              <StatusChip color="gray" className="justify-self-start">
                {t('closed')}
              </StatusChip>
            )}
            {on(cursor).length === 0 ? (
              <EmptyState icon={Clock} title={t('noEvents')} />
            ) : (
              on(cursor).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(e)}
                  className="flex items-center gap-4 rounded-2xl border p-4 text-start transition hover:bg-muted/50"
                  style={{ borderInlineStartWidth: 4, borderInlineStartColor: TYPE_COLOR[e.type] }}
                >
                  <span dir="ltr" className="w-24 shrink-0 text-sm text-muted-foreground">
                    {e.startTime
                      ? `${e.startTime}${e.endTime ? `–${e.endTime}` : ''}`
                      : t('allDay')}
                  </span>
                  <span className="grid gap-0.5">
                    <span className="font-medium">{e.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {[t(`types.${e.type}`), e.classroom?.name, e.teacher?.fullName]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-7">
              {weekdayHeads.map((d) => (
                <div
                  key={d}
                  className="border-b px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {tw(String(dow(d)) as '0')}
                </div>
              ))}
              {days.map((d) => {
                const evs = on(d);
                const max = view === 'month' ? 3 : 20;
                const outside = view === 'month' && d.slice(0, 7) !== cursor.slice(0, 7);
                return (
                  <div
                    key={d}
                    className={cn(
                      'grid content-start gap-1 border-b border-e p-1.5',
                      view === 'month' ? 'min-h-28' : 'min-h-72',
                      isClosed(d) && 'bg-muted/70',
                      outside && 'opacity-50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openDay(d)}
                      className={cn(
                        'flex size-7 items-center justify-center justify-self-start rounded-full text-xs font-medium hover:bg-accent',
                        d === today && 'bg-brand-gradient text-white hover:bg-transparent',
                      )}
                      aria-label={f.dateTime(parseIso(d), { dateStyle: 'full', timeZone: 'UTC' })}
                    >
                      {parseIso(d).getUTCDate()}
                    </button>
                    {isClosed(d) && evs.length === 0 && (
                      <span className="px-1 text-[10px] text-muted-foreground">{t('closed')}</span>
                    )}
                    {evs.slice(0, max).map((e) => (
                      <Chip key={`${e.id}-${d}`} e={e} onClick={() => setSelected(e)} />
                    ))}
                    {evs.length > max && (
                      <button
                        type="button"
                        onClick={() => openDay(d)}
                        className="px-1.5 text-start text-[11px] font-medium text-primary hover:underline"
                      >
                        {t('more', { n: evs.length - max })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
          {TYPES.map((x) => (
            <span key={x} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: TYPE_COLOR[x] }}
                aria-hidden
              />
              {t(`types.${x}`)}
            </span>
          ))}
        </div>
      </Card>
      <EventDetails
        e={selected}
        onClose={() => setSelected(null)}
        onEdit={(e) => {
          setSelected(null);
          setEditing(e);
        }}
      />
      {editing && (
        <EventFormDialog
          event={editing}
          defaultDate={editing.startDate}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </>
  );
}
