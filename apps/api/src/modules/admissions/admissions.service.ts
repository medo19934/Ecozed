import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  paginate,
  type AcceptAdmissionInput,
  type AdmissionDto,
  type AdmissionListQuery,
  type AdmissionListResponse,
  type CreateAdmissionInput,
} from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { pageArgs, requireBranch } from '../../common/utils/scope';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dbDate } from '../attendance/attendance.util';
import { AuditService } from '../audit/audit.service';
import { GuardianLinkService } from '../children/guardian-link.service';
import { ClassesService } from '../classes/classes.service';

type Row = Prisma.AdmissionRequestGetPayload<object> & {
  branch?: { id: string; name: string; nameEn: string | null };
};

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly links: GuardianLinkService,
    private readonly audit: AuditService,
  ) {}

  private async branchMap(ids: string[]) {
    const bs = await this.prisma.raw.daycare.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, nameEn: true },
    });
    return new Map(bs.map((b) => [b.id, b]));
  }

  private toDto(
    a: Row,
    branches: Map<string, { id: string; name: string; nameEn: string | null }>,
  ): AdmissionDto {
    return {
      id: a.id,
      number: a.number,
      branch: branches.get(a.daycareId) ?? { id: a.daycareId, name: '', nameEn: null },
      childName: a.childName,
      childGender: a.childGender,
      childBirthDate: a.childBirthDate.toISOString().slice(0, 10),
      guardianName: a.guardianName,
      relationship: a.relationship,
      phone: a.phone,
      email: a.email,
      notes: a.notes,
      status: a.status,
      rejectReason: a.rejectReason,
      childId: a.childId,
      createdAt: a.createdAt.toISOString(),
    };
  }

  /** Any signed-in user (parents) can request admission to any branch. */
  async create(auth: AuthContext, input: CreateAdmissionInput): Promise<AdmissionDto> {
    const branch = await this.prisma.raw.daycare.findFirst({
      where: { id: input.daycareId, deletedAt: null },
    });
    if (!branch)
      throw new BadRequestException({ code: 'unknown_branch', message: 'Unknown branch' });
    const user = await this.prisma.raw.user.findUniqueOrThrow({ where: { id: auth.userId } });
    const a = await this.prisma.raw.admissionRequest.create({
      data: {
        daycareId: branch.id,
        requestedById: auth.userId,
        childName: input.childName,
        childGender: input.childGender,
        childBirthDate: dbDate(input.childBirthDate),
        guardianName: input.guardianName,
        relationship: input.relationship,
        phone: input.phone ?? null,
        // Default to the requester's own sign-in email so the child links to their account.
        email: input.email ?? user.email,
        notes: input.notes ?? null,
      },
    });
    await this.audit.log({
      action: 'admission.create',
      entity: 'AdmissionRequest',
      entityId: a.id,
      daycareId: branch.id,
    });
    return this.toDto(a, await this.branchMap([branch.id]));
  }

  async mine(auth: AuthContext): Promise<AdmissionDto[]> {
    const rows = await this.prisma.raw.admissionRequest.findMany({
      where: { requestedById: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const b = await this.branchMap([...new Set(rows.map((r) => r.daycareId))]);
    return rows.map((r) => this.toDto(r, b));
  }

  async list(q: AdmissionListQuery): Promise<AdmissionListResponse> {
    const period: Prisma.AdmissionRequestWhereInput = {
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(`${q.from}T00:00:00+03:00`) } : {}),
              ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999+03:00`) } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { childName: { contains: q.search, mode: 'insensitive' } },
              { guardianName: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const where = { ...period, ...(q.status ? { status: q.status } : {}) };
    const [rows, total, grouped] = await Promise.all([
      this.prisma.scoped.admissionRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q.page, q.pageSize),
      }),
      this.prisma.scoped.admissionRequest.count({ where }),
      this.prisma.scoped.admissionRequest.groupBy({
        by: ['status'],
        where: period,
        _count: { _all: true },
      }),
    ]);
    const counts = { total: 0, UNDER_REVIEW: 0, ACCEPTED: 0, REJECTED: 0 };
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      counts.total += g._count._all;
    }
    const b = await this.branchMap([...new Set(rows.map((r) => r.daycareId))]);
    return {
      ...paginate(
        rows.map((r) => this.toDto(r, b)),
        total,
        q.page,
        q.pageSize,
      ),
      counts,
    };
  }

  private async pending(id: string) {
    const a = await this.prisma.scoped.admissionRequest.findFirst({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.status !== 'UNDER_REVIEW') {
      throw new BadRequestException({ code: 'already_reviewed', message: 'Already reviewed' });
    }
    return a;
  }

  /** Accept: creates the child (+ guardian linked to the requesting parent) and assigns a class. */
  async accept(auth: AuthContext, id: string, input: AcceptAdmissionInput): Promise<AdmissionDto> {
    requireBranch(auth);
    const a = await this.pending(id);
    await this.classes.assertClass(input.classroomId);
    const child = await this.prisma.scoped.child.create({
      data: {
        fullName: a.childName,
        gender: a.childGender,
        birthDate: a.childBirthDate,
        classroomId: input.classroomId ?? null,
        medicalNotes: a.notes,
      } as never,
    });
    await this.prisma.scoped.childGuardian.create({
      data: {
        childId: child.id,
        fullName: a.guardianName,
        relationship: a.relationship,
        phone: a.phone,
        email: a.email,
        isPrimary: true,
        userId: a.requestedById,
      } as never,
    });
    // Ensures the parent gets access to this branch (and links by email/phone otherwise).
    await this.links.linkChildGuardians(child.id);
    if (a.requestedById) {
      const g = await this.prisma.raw.childGuardian.findFirst({ where: { childId: child.id } });
      if (g && !g.userId)
        await this.prisma.raw.childGuardian.update({
          where: { id: g.id },
          data: { userId: a.requestedById },
        });
      await this.links.ensureParent(a.requestedById, a.daycareId);
    }
    const updated = await this.prisma.scoped.admissionRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        childId: child.id,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });
    await this.audit.log({
      action: 'admission.accept',
      entity: 'AdmissionRequest',
      entityId: id,
      metadata: { childId: child.id },
    });
    return this.toDto(updated, await this.branchMap([a.daycareId]));
  }

  async reject(auth: AuthContext, id: string, reason: string): Promise<AdmissionDto> {
    const a = await this.pending(id);
    const updated = await this.prisma.scoped.admissionRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });
    await this.audit.log({ action: 'admission.reject', entity: 'AdmissionRequest', entityId: id });
    return this.toDto(updated, await this.branchMap([a.daycareId]));
  }

  /** Parent may withdraw their own pending request. */
  async withdraw(auth: AuthContext, id: string): Promise<{ ok: true }> {
    const a = await this.prisma.raw.admissionRequest.findFirst({
      where: { id, requestedById: auth.userId },
    });
    if (!a) throw new NotFoundException();
    if (a.status !== 'UNDER_REVIEW')
      throw new ForbiddenException({ code: 'already_reviewed', message: 'Already reviewed' });
    await this.prisma.raw.admissionRequest.delete({ where: { id } });
    return { ok: true };
  }
}
