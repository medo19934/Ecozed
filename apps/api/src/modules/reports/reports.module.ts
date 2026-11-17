import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { localDate, StaffPermission } from '@latif/shared';
import { RequirePermissions, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { dbDate } from '../attendance/attendance.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Branch reports: attendance per day, payments, admissions funnel, class occupancy. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(fromIso?: string, toIso?: string) {
    const to = toIso && ISO.test(toIso) ? toIso : localDate();
    const fromDefault = dbDate(to);
    fromDefault.setUTCDate(fromDefault.getUTCDate() - 29);
    const from = fromIso && ISO.test(fromIso) ? fromIso : fromDefault.toISOString().slice(0, 10);
    const range = { gte: dbDate(from), lte: dbDate(to) };
    const db = this.prisma.scoped;

    const [att, subs, admissions, classes] = await Promise.all([
      db.childAttendance.groupBy({ by: ['date', 'status'], where: { date: range }, _count: true }),
      db.subscription.findMany({
        where: {
          startDate: { lte: dbDate(to) },
          endDate: { gte: dbDate(from) },
          status: { not: 'CANCELED' },
        },
        select: { paymentStatus: true, value: true, plan: { select: { name: true } } },
      }),
      db.admissionRequest.groupBy({
        by: ['status'],
        where: { createdAt: { gte: dbDate(from), lte: new Date(`${to}T23:59:59Z`) } },
        _count: true,
      }),
      db.classroom.findMany({
        select: {
          name: true,
          capacity: true,
          _count: { select: { children: { where: { status: 'ACTIVE', deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const days = new Map<
      string,
      { date: string; ATTENDED: number; ABSENT: number; VACATION: number }
    >();
    for (const a of att) {
      const d = a.date.toISOString().slice(0, 10);
      const row = days.get(d) ?? { date: d, ATTENDED: 0, ABSENT: 0, VACATION: 0 };
      if (a.status in row) row[a.status as 'ATTENDED'] += a._count;
      days.set(d, row);
    }
    const sum = (xs: typeof subs) => xs.reduce((n, s) => n + Number(s.value), 0);
    const paid = subs.filter((s) => s.paymentStatus === 'PAID');
    const unpaid = subs.filter((s) => s.paymentStatus === 'UNPAID');
    const count = (k: string) => admissions.find((a) => a.status === k)?._count ?? 0;
    return {
      from,
      to,
      attendance: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      payments: {
        paid: paid.length,
        unpaid: unpaid.length,
        paidAmount: sum(paid),
        unpaidAmount: sum(unpaid),
      },
      admissions: {
        total: count('UNDER_REVIEW') + count('ACCEPTED') + count('REJECTED'),
        underReview: count('UNDER_REVIEW'),
        accepted: count('ACCEPTED'),
        rejected: count('REJECTED'),
      },
      occupancy: classes.map((c) => ({
        name: c.name,
        capacity: c.capacity,
        children: c._count.children,
      })),
    };
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@RequirePermissions(StaffPermission.CAN_VIEW_REPORTS)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.summary(from, to);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
