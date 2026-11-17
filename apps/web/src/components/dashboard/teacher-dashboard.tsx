'use client';

import { localDate, type AuthUser, type ClassroomDto, type DailyReportDto } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { Baby, ClipboardCheck, MessageSquare, NotebookPen, School } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api-client';
import { AttendanceDonut } from './attendance-donut';
import { LatestMessages, StatCard, UpcomingEvents } from './widgets';

/** Teacher: own classes only — today's children, reports to write, messages, schedule. */
export function TeacherDashboard({ user }: { user: AuthUser }) {
  const t = useTranslations('dashboard');
  const today = localDate();
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassroomDto[]>('/classes'),
  });
  const reports = useQuery({
    queryKey: ['daily-reports', today, ''],
    queryFn: () => api.get<DailyReportDto[]>(`/daily-reports?date=${today}`),
  });
  const unread = useQuery({
    queryKey: ['messages', 'unread'],
    queryFn: () => api.get<{ unread: number }>('/messages/unread'),
  });
  const branch = user.memberships.find((m) => m.daycareId === user.daycareId)?.daycareName;
  const kids = reports.data?.length;
  const shared = reports.data?.filter((r) => r.sharedAt).length;
  const toWrite = reports.data?.filter((r) => !r.sharedAt).slice(0, 5) ?? [];

  return (
    <div className="grid gap-6">
      <Card className="border-0 bg-brand-gradient text-white">
        <CardContent className="space-y-1">
          <h1 className="text-xl font-semibold">{t('welcome', { name: user.fullName })}</h1>
          <p className="text-white/85">
            {branch ? t('teacherIntro', { branch }) : t('subtitleNoBranch')}
            {classes.data?.length ? ` · ${classes.data.map((c) => c.name).join('، ')}` : ''}
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={School}
          label={t('myClasses')}
          value={classes.data?.length}
          href="/classes"
          tint="#2fb36d"
        />
        <StatCard
          icon={Baby}
          label={t('myChildren')}
          value={kids}
          href="/attendance"
          tint="#5b6db4"
        />
        <StatCard
          icon={NotebookPen}
          label={t('reportsToday')}
          value={shared === undefined ? undefined : `${shared}/${kids}`}
          href="/daily-reports"
          tint="#f2a33a"
        />
        <StatCard
          icon={MessageSquare}
          label={t('unreadMessages')}
          value={unread.data?.unread}
          href="/messages"
          tint="#7b649b"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <AttendanceDonut scope="branch" />
          {toWrite.length > 0 && (
            <Card className="gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{t('reportsToWrite')}</p>
                <Button size="sm" asChild>
                  <Link href="/daily-reports">
                    <NotebookPen /> {t('writeReports')}
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {toWrite.map((r) => (
                  <span key={r.child.id} className="rounded-full border bg-card px-3 py-1 text-sm">
                    {r.child.fullName}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
        <div className="grid h-fit gap-6">
          <Card className="gap-3 p-5">
            <p className="font-semibold">{t('quickActions')}</p>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/attendance">
                <ClipboardCheck /> {t('takeAttendance')}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/daily-reports">
                <NotebookPen /> {t('writeReports')}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/messages">
                <MessageSquare /> {t('messageParents')}
              </Link>
            </Button>
          </Card>
          <UpcomingEvents />
          <LatestMessages />
        </div>
      </div>
    </div>
  );
}
