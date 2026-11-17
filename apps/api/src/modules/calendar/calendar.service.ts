import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CalendarEventDto, CalendarEventInput, CalendarQuery } from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { isBranchAdmin } from '../../common/utils/scope';
import type { CalendarEvent, Prisma } from '../../generated/prisma/client';
import { branchesWithModuleOff } from '../../common/utils/modules';
import { PrismaService } from '../../prisma/prisma.service';
import { dbDate, isoDate } from '../attendance/attendance.util';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';

/**
 * Calendar events target everyone (ALL, super admin only), a branch, or a class.
 * Visibility is computed here on the data side:
 * - admins/managers: everything in their active branch + ALL;
 * - teachers: branch-wide + ALL + their classes;
 * - parents: ALL + branch-wide and class events of their children's branches/classes.
 * CalendarEvent is exempt from automatic tenancy (daycareId is null for ALL), so
 * every query below filters explicitly.
 */
@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
  ) {}

  private canManage(auth: AuthContext): boolean {
    return auth.isSuperAdmin || auth.permissions.includes('canManageCurriculum');
  }

  private async visibility(auth: AuthContext): Promise<Prisma.CalendarEventWhereInput> {
    const all: Prisma.CalendarEventWhereInput = { audience: 'ALL' };
    if (auth.daycareId && isBranchAdmin(auth)) return { OR: [all, { daycareId: auth.daycareId }] };
    if (auth.daycareId && auth.role === 'STAFF') {
      const classIds = await this.classes.teacherClassIds(auth);
      return {
        OR: [
          all,
          { audience: 'BRANCH', daycareId: auth.daycareId },
          { audience: 'CLASS', classroomId: { in: classIds } },
        ],
      };
    }
    // Parent: their children's branches and classes (any branch).
    const kids = await this.prisma.raw.child.findMany({
      where: { deletedAt: null, status: 'ACTIVE', guardians: { some: { userId: auth.userId } } },
      select: { daycareId: true, classroomId: true },
    });
    const branches = [...new Set(kids.map((k) => k.daycareId))];
    const classIds = kids.map((k) => k.classroomId).filter((c): c is string => Boolean(c));
    return {
      OR: [
        all,
        { audience: 'BRANCH', daycareId: { in: branches } },
        { audience: 'CLASS', classroomId: { in: classIds } },
      ],
    };
  }

  async list(auth: AuthContext, q: CalendarQuery): Promise<CalendarEventDto[]> {
    const rows = await this.prisma.raw.calendarEvent.findMany({
      where: {
        AND: [
          await this.visibility(auth),
          // Branches with the Calendar module off (organisation-wide items stay).
          {
            OR: [
              { daycareId: null },
              { daycareId: { notIn: await branchesWithModuleOff(this.prisma, 'calendar') } },
            ],
          },
          { deletedAt: null, startDate: { lte: dbDate(q.to) }, endDate: { gte: dbDate(q.from) } },
          q.type ? { type: q.type } : {},
          q.classroomId
            ? { OR: [{ classroomId: q.classroomId }, { audience: { in: ['ALL', 'BRANCH'] } }] }
            : {},
        ],
      },
      orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
      take: 1000,
    });
    return this.toDtos(auth, rows);
  }

  private async toDtos(auth: AuthContext, rows: CalendarEvent[]): Promise<CalendarEventDto[]> {
    const ids = <K extends keyof CalendarEvent>(k: K) =>
      [...new Set(rows.map((r) => r[k]).filter(Boolean))] as string[];
    const [branches, classes, units, teachers] = await Promise.all([
      this.prisma.raw.daycare.findMany({
        where: { id: { in: ids('daycareId') } },
        select: { id: true, name: true },
      }),
      this.prisma.raw.classroom.findMany({
        where: { id: { in: ids('classroomId') } },
        select: { id: true, name: true, color: true },
      }),
      this.prisma.raw.unit.findMany({
        where: { id: { in: ids('unitId') } },
        select: { id: true, name: true },
      }),
      this.prisma.raw.membership.findMany({
        where: { id: { in: ids('teacherId') } },
        select: { id: true, user: { select: { fullName: true } } },
      }),
    ]);
    const by = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
    const b = by(branches);
    const c = by(classes);
    const u = by(units);
    const t = by(teachers);
    return rows.map((r) => {
      const teacher = r.teacherId ? t.get(r.teacherId) : undefined;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        audience: r.audience,
        branch: r.daycareId ? (b.get(r.daycareId) ?? null) : null,
        classroom: r.classroomId ? (c.get(r.classroomId) ?? null) : null,
        unit: r.unitId ? (u.get(r.unitId) ?? null) : null,
        teacher: teacher ? { membershipId: teacher.id, fullName: teacher.user.fullName } : null,
        startDate: isoDate(r.startDate),
        endDate: isoDate(r.endDate),
        startTime: r.startTime,
        endTime: r.endTime,
        canEdit: this.canEditRow(auth, r),
      };
    });
  }

  private canEditRow(auth: AuthContext, r: Pick<CalendarEvent, 'audience' | 'daycareId'>): boolean {
    if (!this.canManage(auth)) return false;
    if (r.audience === 'ALL') return auth.isSuperAdmin;
    return r.daycareId === auth.daycareId;
  }

  private async validate(auth: AuthContext, input: CalendarEventInput) {
    if (!this.canManage(auth)) throw new ForbiddenException();
    if (input.audience === 'ALL' && !auth.isSuperAdmin) {
      throw new ForbiddenException({
        code: 'forbidden_all_branches',
        message: 'Only super admins post to all branches',
      });
    }
    if (input.audience !== 'ALL' && !auth.daycareId)
      throw new BadRequestException({ code: 'no_branch', message: 'No branch' });
    const branch = input.audience === 'ALL' ? null : auth.daycareId;
    if (input.classroomId) {
      const ok = await this.prisma.raw.classroom.count({
        where: { id: input.classroomId, daycareId: branch ?? undefined, deletedAt: null },
      });
      if (!ok || !branch)
        throw new BadRequestException({ code: 'unknown_class', message: 'Unknown class' });
    }
    if (input.unitId) {
      const ok = await this.prisma.raw.unit.count({
        where: { id: input.unitId, daycareId: branch ?? undefined, deletedAt: null },
      });
      if (!ok || !branch)
        throw new BadRequestException({ code: 'unknown_unit', message: 'Unknown unit' });
    }
    if (input.teacherId) {
      const ok = await this.prisma.raw.membership.count({
        where: {
          id: input.teacherId,
          daycareId: branch ?? undefined,
          role: { in: ['STAFF', 'MANAGER'] },
          deletedAt: null,
        },
      });
      if (!ok || !branch)
        throw new BadRequestException({ code: 'unknown_teacher', message: 'Unknown teacher' });
    }
    return {
      daycareId: branch,
      audience: input.audience,
      classroomId:
        input.audience === 'CLASS' ? (input.classroomId ?? null) : (input.classroomId ?? null),
      unitId: input.unitId ?? null,
      teacherId: input.teacherId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      startDate: dbDate(input.startDate),
      endDate: dbDate(input.endDate),
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
    };
  }

  async create(auth: AuthContext, input: CalendarEventInput): Promise<CalendarEventDto> {
    const data = await this.validate(auth, input);
    const e = await this.prisma.raw.calendarEvent.create({
      data: { ...data, createdById: auth.userId },
    });
    await this.audit.log({ action: 'calendar.create', entity: 'CalendarEvent', entityId: e.id });
    return (await this.toDtos(auth, [e]))[0]!;
  }

  private async editable(auth: AuthContext, id: string) {
    const e = await this.prisma.raw.calendarEvent.findFirst({ where: { id, deletedAt: null } });
    if (!e) throw new NotFoundException();
    if (!this.canEditRow(auth, e)) throw new ForbiddenException();
    return e;
  }

  async update(
    auth: AuthContext,
    id: string,
    input: CalendarEventInput,
  ): Promise<CalendarEventDto> {
    await this.editable(auth, id);
    const data = await this.validate(auth, input);
    const e = await this.prisma.raw.calendarEvent.update({ where: { id }, data });
    return (await this.toDtos(auth, [e]))[0]!;
  }

  async remove(auth: AuthContext, id: string): Promise<{ ok: true }> {
    await this.editable(auth, id);
    await this.prisma.raw.calendarEvent.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ action: 'calendar.delete', entity: 'CalendarEvent', entityId: id });
    return { ok: true };
  }
}
