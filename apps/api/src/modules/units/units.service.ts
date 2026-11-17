import { Injectable, NotFoundException } from '@nestjs/common';
import type { UnitDto, UnitInput, UnitItemInput, UnitsResponse } from '@latif/shared';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dbDate } from '../attendance/attendance.util';
import { AuditService } from '../audit/audit.service';

const include = {
  items: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
};
type Row = Prisma.UnitGetPayload<{ include: typeof include }>;

const toDto = (u: Row): UnitDto => ({
  id: u.id,
  name: u.name,
  description: u.description,
  minAgeMonths: u.minAgeMonths,
  maxAgeMonths: u.maxAgeMonths,
  goals: u.goals,
  color: u.color,
  startDate: u.startDate ? u.startDate.toISOString().slice(0, 10) : null,
  status: u.status,
  isTest: u.isTest,
  lessons: u.items.filter((i) => i.kind === 'LESSON').length,
  activities: u.items.filter((i) => i.kind === 'ACTIVITY').length,
  items: u.items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    description: i.description,
  })),
  createdAt: u.createdAt.toISOString(),
});

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(status: 'ACTIVE' | 'ARCHIVED', search?: string): Promise<UnitsResponse> {
    const [rows, grouped, teachers] = await Promise.all([
      this.prisma.scoped.unit.findMany({
        where: { status, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) },
        include,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.scoped.unit.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.scoped.membership.findMany({
        where: { role: 'STAFF', staffType: 'TEACHER', status: 'ACTIVE' },
        include: { user: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { user: { fullName: 'asc' } },
        take: 50,
      }),
    ]);
    const counts = { total: 0, active: 0, archived: 0 };
    for (const g of grouped) {
      counts[g.status === 'ACTIVE' ? 'active' : 'archived'] = g._count._all;
      counts.total += g._count._all;
    }
    return {
      items: rows.map(toDto),
      counts,
      teachers: teachers.map((t) => ({
        membershipId: t.id,
        fullName: t.user.fullName,
        avatarUrl: t.user.avatarUrl,
        specialties: t.specialties,
      })),
    };
  }

  private async load(id: string): Promise<Row> {
    const u = await this.prisma.scoped.unit.findFirst({ where: { id }, include });
    if (!u) throw new NotFoundException();
    return u;
  }

  private data(input: UnitInput) {
    return {
      name: input.name,
      description: input.description ?? null,
      minAgeMonths: input.minAgeMonths ?? null,
      maxAgeMonths: input.maxAgeMonths ?? null,
      goals: input.goals,
      color: input.color ?? null,
      startDate: input.startDate ? dbDate(input.startDate) : null,
    };
  }

  async create(input: UnitInput): Promise<UnitDto> {
    const u = await this.prisma.scoped.unit.create({ data: this.data(input) as never });
    await this.audit.log({ action: 'unit.create', entity: 'Unit', entityId: u.id });
    return toDto(await this.load(u.id));
  }

  async update(id: string, input: UnitInput): Promise<UnitDto> {
    await this.load(id);
    await this.prisma.scoped.unit.update({ where: { id }, data: this.data(input) });
    return toDto(await this.load(id));
  }

  async setArchived(id: string, archived: boolean): Promise<UnitDto> {
    await this.load(id);
    await this.prisma.scoped.unit.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });
    await this.audit.log({
      action: archived ? 'unit.archive' : 'unit.restore',
      entity: 'Unit',
      entityId: id,
    });
    return toDto(await this.load(id));
  }

  async addItem(unitId: string, input: UnitItemInput): Promise<UnitDto> {
    const u = await this.load(unitId);
    await this.prisma.scoped.unitItem.create({
      data: {
        unitId,
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        sortOrder: u.items.length,
      } as never,
    });
    return toDto(await this.load(unitId));
  }

  async updateItem(unitId: string, itemId: string, input: UnitItemInput): Promise<UnitDto> {
    const n = await this.prisma.scoped.unitItem.updateMany({
      where: { id: itemId, unitId },
      data: { kind: input.kind, title: input.title, description: input.description ?? null },
    });
    if (!n.count) throw new NotFoundException();
    return toDto(await this.load(unitId));
  }

  async removeItem(unitId: string, itemId: string): Promise<UnitDto> {
    const n = await this.prisma.scoped.unitItem.deleteMany({ where: { id: itemId, unitId } });
    if (!n.count) throw new NotFoundException();
    return toDto(await this.load(unitId));
  }

  /** Dashboard: active units + activities (unit activities and calendar activities). */
  async counts(daycareIds: string[]) {
    const [units, unitActivities] = await Promise.all([
      this.prisma.raw.unit.count({
        where: { daycareId: { in: daycareIds }, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.raw.unitItem.count({
        where: { daycareId: { in: daycareIds }, kind: 'ACTIVITY', unit: { deletedAt: null } },
      }),
    ]);
    const calendarActivities = await this.prisma.raw.calendarEvent.count({
      where: {
        deletedAt: null,
        type: 'ACTIVITY',
        OR: [{ daycareId: { in: daycareIds } }, { audience: 'ALL' }],
      },
    });
    return { units, activities: unitActivities + calendarActivities };
  }
}
