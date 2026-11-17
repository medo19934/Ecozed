import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  IssuedPassword,
  CreateStaffInput,
  Paginated,
  StaffDetail,
  StaffListItem,
  StaffListQuery,
  UpdateStaffInput,
} from '@latif/shared';
import { paginate } from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { isBranchAdmin, pageArgs, requireBranch } from '../../common/utils/scope';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CredentialsService } from '../auth/credentials.service';
import { ClassesService } from '../classes/classes.service';

const include = {
  user: {
    select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, googleId: true },
  },
  classLinks: { include: { classroom: { select: { id: true, name: true, deletedAt: true } } } },
} satisfies Prisma.MembershipInclude;

type Row = Prisma.MembershipGetPayload<{ include: typeof include }>;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
    private readonly credentials: CredentialsService,
  ) {}

  async list(q: StaffListQuery): Promise<Paginated<StaffListItem>> {
    const where: Prisma.MembershipWhereInput = {
      role: q.role ? q.role : { in: ['MANAGER', 'STAFF'] },
      status: q.status ?? 'ACTIVE',
      ...(q.search
        ? {
            user: {
              OR: [
                { fullName: { contains: q.search, mode: 'insensitive' } },
                { email: { contains: q.search, mode: 'insensitive' } },
                { phone: { contains: q.search } },
              ],
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.scoped.membership.findMany({
        where,
        include,
        orderBy: { user: { fullName: q.order } },
        ...pageArgs(q.page, q.pageSize),
      }),
      this.prisma.scoped.membership.count({ where }),
    ]);
    return paginate(rows.map(toListItem), total, q.page, q.pageSize);
  }

  async get(id: string): Promise<StaffDetail> {
    return toDetail(await this.load(id));
  }

  async issuePassword(id: string): Promise<IssuedPassword> {
    const m = await this.load(id);
    return this.credentials.issue(m.userId);
  }

  private async load(id: string): Promise<Row> {
    const m = await this.prisma.scoped.membership.findFirst({
      where: { id, role: { in: ['MANAGER', 'STAFF'] } },
      include,
    });
    if (!m) throw new NotFoundException();
    return m;
  }

  /** Only super admins manage managers; only branch admins set roles/permissions. */
  private guardEdit(
    auth: AuthContext,
    input: { role?: string; permissions?: string[] },
    target?: Row,
  ) {
    if ((input.role === 'MANAGER' || target?.role === 'MANAGER') && !auth.isSuperAdmin) {
      throw new ForbiddenException({
        message: 'Only super admins manage branch managers',
        code: 'forbidden_manager',
      });
    }
    if (target && target.id === auth.membershipId && input.permissions) {
      throw new ForbiddenException({
        message: 'You cannot change your own permissions',
        code: 'forbidden_self',
      });
    }
  }

  async create(
    auth: AuthContext,
    input: CreateStaffInput,
  ): Promise<StaffDetail & { issued: IssuedPassword | null }> {
    const daycareId = requireBranch(auth);
    this.guardEdit(auth, input);
    await Promise.all(input.classIds.map((id) => this.classes.assertClass(id)));
    const canSetPerms = isBranchAdmin(auth);

    let user = await this.prisma.raw.user.findFirst({ where: { email: input.email } });
    if (user?.deletedAt)
      throw new BadRequestException({ message: 'Account disabled', code: 'account_disabled' });
    if (input.phone) {
      const phoneOwner = await this.prisma.raw.user.findFirst({ where: { phone: input.phone } });
      if (phoneOwner && phoneOwner.id !== user?.id) {
        throw new ConflictException({ message: 'Phone already used', code: 'phone_taken' });
      }
    }
    if (user) {
      const existing = await this.prisma.raw.membership.findFirst({
        where: { userId: user.id, daycareId },
      });
      if (existing && existing.role !== 'PARENT' && !existing.deletedAt) {
        throw new ConflictException({
          message: 'Already a staff member here',
          code: 'staff_exists',
        });
      }
      if (existing) {
        // A parent in this branch becoming staff keeps one membership (staff role wins).
        await this.prisma.raw.membership.delete({ where: { id: existing.id } });
      }
    } else {
      user = await this.prisma.raw.user.create({
        data: { email: input.email, fullName: input.fullName, phone: input.phone ?? null },
      });
    }

    const m = await this.prisma.scoped.membership.create({
      data: {
        userId: user.id,
        role: input.role,
        staffType: input.staffType,
        specialties: input.specialties,
        qualification: input.qualification ?? null,
        address: input.address ?? null,
        joinDate: input.joinDate ? new Date(input.joinDate) : new Date(),
        permissions: canSetPerms ? input.permissions : [],
      } as never,
    });
    for (const classId of input.classIds) {
      await this.prisma.scoped.classTeacher.create({
        data: { classroomId: classId, membershipId: m.id } as never,
      });
    }
    await this.audit.log({
      action: 'staff.create',
      entity: 'Membership',
      entityId: m.id,
      metadata: { email: input.email, role: input.role },
    });
    // New login → one-time password for the admin to hand over.
    const issued = user.passwordHash ? null : await this.credentials.issue(user.id);
    return { ...(await this.get(m.id)), issued };
  }

  async update(auth: AuthContext, id: string, input: UpdateStaffInput): Promise<StaffDetail> {
    const target = await this.load(id);
    this.guardEdit(auth, input, target);
    if (input.classIds) await Promise.all(input.classIds.map((c) => this.classes.assertClass(c)));
    const canSetPerms = isBranchAdmin(auth);

    if (input.fullName || input.phone !== undefined) {
      await this.prisma.raw.user.update({
        where: { id: target.userId },
        data: {
          ...(input.fullName ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });
    }
    await this.prisma.scoped.membership.update({
      where: { id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.staffType ? { staffType: input.staffType } : {}),
        ...(input.specialties ? { specialties: input.specialties } : {}),
        ...(input.qualification !== undefined ? { qualification: input.qualification } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.joinDate !== undefined
          ? { joinDate: input.joinDate ? new Date(input.joinDate) : null }
          : {}),
        ...(input.permissions && canSetPerms ? { permissions: input.permissions } : {}),
      },
    });
    if (input.classIds) {
      await this.prisma.scoped.classTeacher.deleteMany({ where: { membershipId: id } });
      for (const classId of input.classIds) {
        await this.prisma.scoped.classTeacher.create({
          data: { classroomId: classId, membershipId: id } as never,
        });
      }
    }
    if (input.permissions && canSetPerms) {
      await this.audit.log({
        action: 'staff.permissions',
        entity: 'Membership',
        entityId: id,
        metadata: input.permissions,
      });
    }
    await this.audit.log({ action: 'staff.update', entity: 'Membership', entityId: id });
    return this.get(id);
  }

  async setArchived(auth: AuthContext, id: string, archived: boolean): Promise<StaffDetail> {
    const target = await this.load(id);
    this.guardEdit(auth, {}, target);
    if (target.id === auth.membershipId) {
      throw new ForbiddenException({
        message: 'You cannot archive yourself',
        code: 'forbidden_self',
      });
    }
    await this.prisma.scoped.membership.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });
    if (archived) {
      // Archived staff lose access immediately.
      await this.prisma.raw.refreshToken.updateMany({
        where: { userId: target.userId, daycareId: target.daycareId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      action: archived ? 'staff.archive' : 'staff.restore',
      entity: 'Membership',
      entityId: id,
    });
    return this.get(id);
  }

  /** Ensures the staff member exists in this branch (for file routes). */
  async assertExists(id: string): Promise<void> {
    await this.load(id);
  }
}

const toListItem = (m: Row): StaffListItem => ({
  membershipId: m.id,
  userId: m.userId,
  fullName: m.user.fullName,
  email: m.user.email,
  phone: m.user.phone,
  avatarUrl: m.user.avatarUrl,
  role: m.role as 'MANAGER' | 'STAFF',
  staffType: m.staffType,
  status: m.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
  specialties: m.specialties,
  joinDate: m.joinDate ? m.joinDate.toISOString().slice(0, 10) : null,
  pendingFirstLogin: !m.user.googleId,
  isTest: m.isTest,
  classes: m.classLinks
    .filter((l) => !l.classroom.deletedAt)
    .map((l) => ({ id: l.classroom.id, name: l.classroom.name })),
});

const toDetail = (m: Row): StaffDetail => ({
  ...toListItem(m),
  qualification: m.qualification,
  address: m.address,
  permissions: m.permissions,
  createdAt: m.createdAt.toISOString(),
});
