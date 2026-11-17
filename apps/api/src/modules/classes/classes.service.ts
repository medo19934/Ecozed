import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClassroomDto, ClassroomInput } from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { isBranchAdmin } from '../../common/utils/scope';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const include = {
  teachers: {
    include: { membership: { include: { user: { select: { fullName: true, avatarUrl: true } } } } },
  },
  _count: { select: { children: { where: { deletedAt: null, status: 'ACTIVE' as const } } } },
};

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Classes a teacher is assigned to (empty for non-staff). */
  async teacherClassIds(auth: AuthContext): Promise<string[]> {
    if (!auth.membershipId) return [];
    const links = await this.prisma.scoped.classTeacher.findMany({
      where: { membershipId: auth.membershipId },
      select: { classroomId: true },
    });
    return links.map((l) => l.classroomId);
  }

  async list(auth: AuthContext): Promise<ClassroomDto[]> {
    const where = isBranchAdmin(auth) ? {} : { id: { in: await this.teacherClassIds(auth) } };
    const rows = await this.prisma.scoped.classroom.findMany({
      where,
      include,
      orderBy: { name: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(input: ClassroomInput): Promise<ClassroomDto> {
    await this.assertTeachers(input.teacherIds);
    const { teacherIds, ...data } = input;
    const c = await this.prisma.scoped.classroom.create({ data: data as never });
    await this.setTeachers(c.id, teacherIds);
    await this.audit.log({ action: 'class.create', entity: 'Classroom', entityId: c.id });
    return this.get(c.id);
  }

  async update(id: string, input: ClassroomInput): Promise<ClassroomDto> {
    await this.get(id);
    await this.assertTeachers(input.teacherIds);
    const { teacherIds, ...data } = input;
    await this.prisma.scoped.classroom.update({ where: { id }, data });
    await this.setTeachers(id, teacherIds);
    await this.audit.log({ action: 'class.update', entity: 'Classroom', entityId: id });
    return this.get(id);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const c = await this.get(id);
    if (c.childrenCount > 0) {
      throw new BadRequestException({
        message: 'Class still has children',
        code: 'class_not_empty',
      });
    }
    await this.prisma.scoped.classroom.delete({ where: { id } });
    await this.audit.log({ action: 'class.delete', entity: 'Classroom', entityId: id });
    return { ok: true };
  }

  async get(id: string): Promise<ClassroomDto> {
    const c = await this.prisma.scoped.classroom.findFirst({ where: { id }, include });
    if (!c) throw new NotFoundException();
    return toDto(c);
  }

  async assertClass(id: string | null | undefined): Promise<void> {
    if (!id) return;
    const n = await this.prisma.scoped.classroom.count({ where: { id } });
    if (!n) throw new BadRequestException({ message: 'Unknown class', code: 'unknown_class' });
  }

  private async assertTeachers(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const n = await this.prisma.scoped.membership.count({
      where: { id: { in: ids }, role: { in: ['STAFF', 'MANAGER'] }, status: 'ACTIVE' },
    });
    if (n !== new Set(ids).size)
      throw new BadRequestException({ message: 'Unknown teacher', code: 'unknown_teacher' });
  }

  /** Replaces a class's teachers. */
  async setTeachers(classroomId: string, membershipIds: string[]): Promise<void> {
    await this.prisma.scoped.classTeacher.deleteMany({ where: { classroomId } });
    if (membershipIds.length) {
      await this.prisma.scoped.classTeacher.createMany({
        data: [...new Set(membershipIds)].map((membershipId) => ({
          classroomId,
          membershipId,
        })) as never,
      });
    }
  }
}

type Row = {
  id: string;
  name: string;
  capacity: number;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  color: string | null;
  isTest: boolean;
  _count: { children: number };
  teachers: {
    membershipId: string;
    membership: { user: { fullName: string; avatarUrl: string | null } };
  }[];
};

const toDto = (c: Row): ClassroomDto => ({
  id: c.id,
  name: c.name,
  capacity: c.capacity,
  minAgeMonths: c.minAgeMonths,
  maxAgeMonths: c.maxAgeMonths,
  color: c.color,
  isTest: c.isTest,
  childrenCount: c._count.children,
  teachers: c.teachers.map((t) => ({
    membershipId: t.membershipId,
    fullName: t.membership.user.fullName,
    avatarUrl: t.membership.user.avatarUrl,
  })),
});
