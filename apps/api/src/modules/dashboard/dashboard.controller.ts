import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DashboardQuerySchema,
  localDate,
  type DashboardAttendance,
  type DashboardSummary,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentAuth, Roles, type AuthContext } from '../../common/decorators/auth.decorators';
import { requireBranch } from '../../common/utils/scope';
import { dbDate } from '../attendance/attendance.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { UnitsService } from '../units/units.service';

class DashboardQueryDto extends createZodDto(DashboardQuerySchema) {}

/** Real counts only. Super admins may aggregate all branches (scope=all). */
@ApiTags('dashboard')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly units: UnitsService,
  ) {}

  private async branchIds(auth: AuthContext, scope: 'branch' | 'all'): Promise<string[]> {
    if (scope === 'all') {
      if (!auth.isSuperAdmin) throw new ForbiddenException();
      return (
        await this.prisma.raw.daycare.findMany({ where: { deletedAt: null }, select: { id: true } })
      ).map((d) => d.id);
    }
    return [requireBranch(auth)];
  }

  @Get('summary')
  async summary(
    @CurrentAuth() auth: AuthContext,
    @Query() q: DashboardQueryDto,
  ): Promise<DashboardSummary> {
    const ids = await this.branchIds(auth, q.scope);
    const childScope = q.scope === 'all' ? {} : await this.attendance.childScopeFor(auth);
    const [children, staff, classes] = await Promise.all([
      this.prisma.raw.child.count({
        where: { AND: [childScope, { daycareId: { in: ids }, deletedAt: null, status: 'ACTIVE' }] },
      }),
      this.prisma.raw.membership.count({
        where: {
          daycareId: { in: ids },
          deletedAt: null,
          status: 'ACTIVE',
          role: { in: ['MANAGER', 'STAFF'] },
        },
      }),
      this.prisma.raw.classroom.count({ where: { daycareId: { in: ids }, deletedAt: null } }),
    ]);
    const { units, activities } = await this.units.counts(ids);
    return { scope: q.scope, children, staff, classes, units, activities };
  }

  @Get('attendance')
  async attendanceChart(
    @CurrentAuth() auth: AuthContext,
    @Query() q: DashboardQueryDto,
  ): Promise<DashboardAttendance> {
    const ids = await this.branchIds(auth, q.scope);
    const date = q.date ?? localDate();
    const scope = q.scope === 'all' ? {} : await this.attendance.childScopeFor(auth);
    const { total, counts } = await this.attendance.dayCounts(ids, date, {
      AND: [scope, q.classroomId ? { classroomId: q.classroomId } : {}],
    });
    return { date, total, counts, updatedAt: new Date().toISOString() };
  }

  /** Manager / general admin: money, admissions, daily reports and staff presence today. */
  @Get('extras')
  async extras(@CurrentAuth() auth: AuthContext, @Query() q: DashboardQueryDto) {
    const ids = await this.branchIds(auth, q.scope);
    const today = dbDate(localDate());
    const where = { daycareId: { in: ids } };
    const [unpaid, pendingAdmissions, activeChildren, reportsShared, staffTotal, staffIn] =
      await Promise.all([
        this.prisma.raw.subscription.findMany({
          where: { ...where, deletedAt: null, paymentStatus: 'UNPAID', status: 'ACTIVE' },
          select: { value: true },
        }),
        this.prisma.raw.admissionRequest.count({ where: { ...where, status: 'UNDER_REVIEW' } }),
        this.prisma.raw.child.count({ where: { ...where, deletedAt: null, status: 'ACTIVE' } }),
        this.prisma.raw.dailyReport.count({
          where: { ...where, date: today, sharedAt: { not: null } },
        }),
        this.prisma.raw.membership.count({
          where: {
            ...where,
            deletedAt: null,
            status: 'ACTIVE',
            role: { in: ['MANAGER', 'STAFF'] },
          },
        }),
        this.prisma.raw.staffAttendance.count({ where: { ...where, date: today } }),
      ]);
    return {
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((n, s) => n + Number(s.value), 0),
      pendingAdmissions,
      reports: { shared: reportsShared, total: activeChildren },
      staff: { checkedIn: staffIn, total: staffTotal },
    };
  }
}
