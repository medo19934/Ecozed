import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  paginate,
  type CreateUserInput,
  type IssuedPassword,
  type ManagedRole,
  type ManagedUser,
  type MoveChildInput,
  type Paginated,
  type UpdateUserInput,
  type UserAuditEntry,
  type UserListQuery,
} from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { pageArgs } from '../../common/utils/scope';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CredentialsService } from '../auth/credentials.service';
import { GuardianLinkService } from '../children/guardian-link.service';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

const include = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      lastLoginAt: true,
      disabledAt: true,
      passwordHash: true,
    },
  },
  daycare: { select: { id: true, name: true } },
  classLinks: { include: { classroom: { select: { id: true, name: true } } } },
} satisfies Prisma.MembershipInclude;
type Row = Prisma.MembershipGetPayload<{ include: typeof include }>;

/**
 * Settings > Users. Server-only: runs as the signed-in admin under Row Level Security
 * (the database refuses what the role may not do), plus explicit checks here.
 * General admin: everyone. Branch manager: teachers and parents of their own branch.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
    private readonly links: GuardianLinkService,
    private readonly audit: AuditService,
  ) {}

  /** Runs `fn` in one transaction as the actor, with RLS on (role latif_rls + verified user id). */
  private asActor<T>(auth: AuthContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.raw.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('role', 'latif_rls', true), set_config('app.user_id', ${auth.userId}, true)`;
      return fn(tx);
    });
  }

  private isSuper(auth: AuthContext) {
    return auth.isSuperAdmin;
  }

  /** The branch an action targets and whether the actor may act on that role there. */
  private assertScope(auth: AuthContext, daycareId: string, role: ManagedRole) {
    if (this.isSuper(auth)) return;
    if (auth.role !== 'MANAGER' || auth.daycareId !== daycareId) {
      throw new ForbiddenException({ code: 'other_branch', message: 'Only your own branch' });
    }
    if (role === 'MANAGER') {
      throw new ForbiddenException({
        code: 'forbidden_manager',
        message: 'Managers cannot manage managers',
      });
    }
  }

  private toDto(m: Row, kids: ManagedUser['children']): ManagedUser {
    return {
      membershipId: m.id,
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      phone: m.user.phone,
      role: m.role as ManagedRole,
      branch: m.daycare,
      status: m.status === 'ACTIVE' && !m.user.disabledAt ? 'ACTIVE' : 'DISABLED',
      classes: m.classLinks.map((c) => c.classroom),
      children: kids,
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      hasPassword: Boolean(m.user.passwordHash),
    };
  }

  private async childrenOf(userIds: string[], daycareIds: string[]) {
    const rows = await this.prisma.raw.childGuardian.findMany({
      where: { userId: { in: userIds }, daycareId: { in: daycareIds }, child: { deletedAt: null } },
      include: {
        child: { select: { id: true, fullName: true, classroom: { select: { name: true } } } },
      },
    });
    return (userId: string, daycareId: string) =>
      rows
        .filter((g) => g.userId === userId && g.daycareId === daycareId)
        .map((g) => ({
          id: g.child.id,
          fullName: g.child.fullName,
          relationship: g.relationship,
          classroom: g.child.classroom?.name ?? null,
        }));
  }

  async list(auth: AuthContext, q: UserListQuery): Promise<Paginated<ManagedUser>> {
    const where: Prisma.MembershipWhereInput = {
      AND: [
        { deletedAt: null, daycare: { deletedAt: null }, user: { deletedAt: null } },
        this.isSuper(auth)
          ? q.daycareId
            ? { daycareId: q.daycareId }
            : {}
          : { daycareId: auth.daycareId ?? '-', role: { in: ['STAFF', 'PARENT'] } },
        q.role ? { role: q.role } : {},
        q.status === 'ACTIVE' ? { status: 'ACTIVE', user: { disabledAt: null } } : {},
        q.status === 'DISABLED'
          ? { OR: [{ status: { not: 'ACTIVE' } }, { user: { disabledAt: { not: null } } }] }
          : {},
        q.search
          ? {
              user: {
                OR: [
                  { fullName: { contains: q.search, mode: 'insensitive' } },
                  { email: { contains: q.search.toLowerCase() } },
                  { phone: { contains: q.search } },
                ],
              },
            }
          : {},
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.raw.membership.findMany({
        where,
        include,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        ...pageArgs(q.page, q.pageSize),
      }),
      this.prisma.raw.membership.count({ where }),
    ]);
    const kids = await this.childrenOf(
      rows.map((r) => r.userId),
      rows.map((r) => r.daycareId),
    );
    return paginate(
      rows.map((r) => this.toDto(r, kids(r.userId, r.daycareId))),
      total,
      q.page,
      q.pageSize,
    );
  }

  private async load(membershipId: string): Promise<Row> {
    const m = await this.prisma.raw.membership.findFirst({
      where: { id: membershipId, deletedAt: null },
      include,
    });
    if (!m || !['MANAGER', 'STAFF', 'PARENT'].includes(m.role)) throw new NotFoundException();
    return m;
  }

  async get(auth: AuthContext, membershipId: string): Promise<ManagedUser> {
    const m = await this.load(membershipId);
    this.assertScope(auth, m.daycareId, m.role as ManagedRole);
    return this.toDto(m, (await this.childrenOf([m.userId], [m.daycareId]))(m.userId, m.daycareId));
  }

  async create(
    auth: AuthContext,
    input: CreateUserInput,
  ): Promise<{ user: ManagedUser; issued: IssuedPassword | null }> {
    const daycareId = this.isSuper(auth) ? (input.daycareId ?? auth.daycareId) : auth.daycareId;
    if (!daycareId)
      throw new BadRequestException({ code: 'no_branch', message: 'Choose a branch' });
    this.assertScope(auth, daycareId, input.role);
    const membershipId = await this.asActor(auth, async (tx) => {
      let user = await tx.user.findFirst({
        where: {
          OR: [
            ...(input.email ? [{ email: input.email }] : []),
            ...(input.phone ? [{ phone: input.phone }] : []),
          ],
        },
      });
      if (user) {
        const existing = await this.prisma.raw.membership.findFirst({
          where: { userId: user.id, daycareId, deletedAt: null },
        });
        if (existing)
          throw new ConflictException({ code: 'user_exists', message: 'Already in this branch' });
      } else {
        user = await tx.user.create({
          data: {
            fullName: input.fullName,
            email: input.email ?? null,
            phone: input.phone ?? null,
          },
        });
      }
      // RLS: a manager can only insert STAFF/PARENT memberships of their own branch.
      const m = await tx.membership.create({
        data: { userId: user.id, daycareId, role: input.role },
      });
      for (const classId of input.role === 'STAFF' ? input.classIds : []) {
        const cls = await tx.classroom.findFirst({
          where: { id: classId, daycareId, deletedAt: null },
        });
        if (!cls)
          throw new BadRequestException({ code: 'unknown_class', message: 'Unknown class' });
        await tx.classTeacher.create({
          data: { daycareId, classroomId: classId, membershipId: m.id },
        });
      }
      for (const link of input.role === 'PARENT' ? input.children : []) {
        await this.linkChildTx(tx, daycareId, user, link.childId, link.relationship);
      }
      return m.id;
    });
    const m = await this.load(membershipId);
    const issued = m.user.passwordHash ? null : await this.credentials.issue(m.userId);
    await this.audit.log({
      action: 'users.create',
      entity: 'Membership',
      entityId: m.id,
      daycareId,
      metadata: {
        target: m.user.fullName,
        role: input.role,
        email: input.email ?? null,
        phone: input.phone ?? null,
      },
    });
    return { user: await this.get(auth, membershipId), issued };
  }

  private async linkChildTx(
    tx: Tx,
    daycareId: string,
    user: { id: string; fullName: string; email: string | null; phone: string | null },
    childId: string,
    relationship: string,
  ) {
    // RLS: only children the actor may see.
    const child = await tx.child.findFirst({ where: { id: childId, daycareId, deletedAt: null } });
    if (!child) throw new NotFoundException({ code: 'unknown_child', message: 'Unknown child' });
    const dup = await tx.childGuardian.findFirst({ where: { childId, userId: user.id } });
    if (dup) {
      await tx.childGuardian.update({ where: { id: dup.id }, data: { relationship } });
      return;
    }
    const count = await tx.childGuardian.count({ where: { childId } });
    await tx.childGuardian.create({
      data: {
        daycareId,
        childId,
        userId: user.id,
        fullName: user.fullName,
        relationship,
        email: user.email,
        phone: user.phone,
        isPrimary: count === 0,
      },
    });
  }

  async update(
    auth: AuthContext,
    membershipId: string,
    input: UpdateUserInput,
  ): Promise<ManagedUser> {
    const m = await this.load(membershipId);
    this.assertScope(auth, m.daycareId, m.role as ManagedRole);
    if (input.role) this.assertScope(auth, m.daycareId, input.role);
    const targetBranch = input.daycareId ?? m.daycareId;
    if (targetBranch !== m.daycareId && !this.isSuper(auth)) {
      throw new ForbiddenException({
        code: 'other_branch',
        message: 'Only a general admin can move people between branches',
      });
    }
    await this.asActor(auth, async (tx) => {
      if (input.fullName !== undefined || input.phone !== undefined) {
        if (input.phone) {
          const owner = await tx.user.findFirst({
            where: { phone: input.phone, id: { not: m.userId } },
          });
          if (owner)
            throw new ConflictException({ code: 'phone_taken', message: 'Phone already used' });
        }
        await tx.user.update({
          where: { id: m.userId },
          data: {
            ...(input.fullName ? { fullName: input.fullName } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
          },
        });
      }
      if (input.role || targetBranch !== m.daycareId) {
        if (targetBranch !== m.daycareId) {
          const clash = await tx.membership.findFirst({
            where: { userId: m.userId, daycareId: targetBranch, deletedAt: null },
          });
          if (clash)
            throw new ConflictException({ code: 'user_exists', message: 'Already in that branch' });
          await tx.classTeacher.deleteMany({ where: { membershipId: m.id } });
        }
        await tx.membership.update({
          where: { id: m.id },
          data: { ...(input.role ? { role: input.role } : {}), daycareId: targetBranch },
        });
      }
      if (input.classIds) {
        await tx.classTeacher.deleteMany({ where: { membershipId: m.id } });
        for (const classId of (input.role ?? m.role) === 'STAFF' ? input.classIds : []) {
          const cls = await tx.classroom.findFirst({
            where: { id: classId, daycareId: targetBranch, deletedAt: null },
          });
          if (!cls)
            throw new BadRequestException({ code: 'unknown_class', message: 'Unknown class' });
          await tx.classTeacher.create({
            data: { daycareId: targetBranch, classroomId: classId, membershipId: m.id },
          });
        }
      }
    });
    await this.audit.log({
      action: 'users.update',
      entity: 'Membership',
      entityId: m.id,
      daycareId: m.daycareId,
      metadata: { target: m.user.fullName, changes: input as Prisma.InputJsonValue },
    });
    return this.get(auth, membershipId);
  }

  /** Blocks sign-in and data access at once; every record is kept. */
  async setActive(auth: AuthContext, membershipId: string, active: boolean): Promise<ManagedUser> {
    const m = await this.load(membershipId);
    this.assertScope(auth, m.daycareId, m.role as ManagedRole);
    if (m.userId === auth.userId)
      throw new BadRequestException({ code: 'forbidden_self', message: 'Not yourself' });
    await this.asActor(auth, (tx) =>
      tx.membership.update({
        where: { id: m.id },
        data: { status: active ? 'ACTIVE' : 'ARCHIVED' },
      }),
    );
    const others = await this.prisma.raw.membership.count({
      where: { userId: m.userId, id: { not: m.id }, status: 'ACTIVE', deletedAt: null },
    });
    if (!active && others === 0) {
      // No other branch: the person can no longer sign in at all.
      await this.prisma.raw.user.update({
        where: { id: m.userId },
        data: { disabledAt: new Date() },
      });
      await this.prisma.raw.refreshToken.updateMany({
        where: { userId: m.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (active)
      await this.prisma.raw.user.update({ where: { id: m.userId }, data: { disabledAt: null } });
    await this.audit.log({
      action: active ? 'users.reactivate' : 'users.deactivate',
      entity: 'Membership',
      entityId: m.id,
      daycareId: m.daycareId,
      metadata: { target: m.user.fullName, role: m.role },
    });
    return this.get(auth, membershipId);
  }

  /** Records that tie a person to the branch's history (deleting them would break it). */
  private async linkedRecords(userId: string, membershipId: string) {
    const [guardianOf, messages, reports, attendanceRecorded, staffDays, admissions, vacations] =
      await Promise.all([
        this.prisma.raw.childGuardian.count({ where: { userId } }),
        this.prisma.raw.message.count({ where: { senderId: userId } }),
        this.prisma.raw.dailyReport.count({ where: { authorId: userId } }),
        this.prisma.raw.childAttendance.count({ where: { recordedById: userId } }),
        this.prisma.raw.staffAttendance.count({ where: { membershipId } }),
        this.prisma.raw.admissionRequest.count({ where: { requestedById: userId } }),
        this.prisma.raw.vacationRequest.count({ where: { requestedById: userId } }),
      ]);
    return { guardianOf, messages, reports, attendanceRecorded, staffDays, admissions, vacations };
  }

  async remove(auth: AuthContext, membershipId: string): Promise<{ ok: true }> {
    const m = await this.load(membershipId);
    this.assertScope(auth, m.daycareId, m.role as ManagedRole);
    if (m.userId === auth.userId)
      throw new BadRequestException({ code: 'forbidden_self', message: 'Not yourself' });
    const records = await this.linkedRecords(m.userId, m.id);
    const total = Object.values(records).reduce((a, b) => a + b, 0);
    if (total > 0) {
      throw new ConflictException({
        code: 'has_records',
        message: 'This person has records: deactivate instead',
        records,
      });
    }
    await this.asActor(auth, async (tx) => {
      await tx.classTeacher.deleteMany({ where: { membershipId: m.id } });
      await tx.membership.delete({ where: { id: m.id } });
    });
    const left = await this.prisma.raw.membership.count({ where: { userId: m.userId } });
    const u = await this.prisma.raw.user.findUnique({ where: { id: m.userId } });
    if (left === 0 && u && !u.isSuperAdmin) {
      await this.prisma.raw.refreshToken.deleteMany({ where: { userId: m.userId } });
      await this.prisma.raw.user.delete({ where: { id: m.userId } });
    }
    await this.audit.log({
      action: 'users.delete',
      entity: 'Membership',
      entityId: m.id,
      daycareId: m.daycareId,
      metadata: { target: m.user.fullName, role: m.role },
    });
    return { ok: true };
  }

  async resetPassword(auth: AuthContext, membershipId: string): Promise<IssuedPassword> {
    const m = await this.load(membershipId);
    this.assertScope(auth, m.daycareId, m.role as ManagedRole);
    const issued = await this.credentials.issue(m.userId);
    await this.audit.log({
      action: 'users.password_reset',
      entity: 'User',
      entityId: m.userId,
      daycareId: m.daycareId,
      metadata: { target: m.user.fullName },
    });
    return issued;
  }

  async linkChild(
    auth: AuthContext,
    membershipId: string,
    childId: string,
    relationship: string,
  ): Promise<ManagedUser> {
    const m = await this.load(membershipId);
    if (m.role !== 'PARENT')
      throw new BadRequestException({ code: 'not_parent', message: 'Only parents have children' });
    this.assertScope(auth, m.daycareId, 'PARENT');
    await this.asActor(auth, (tx) =>
      this.linkChildTx(tx, m.daycareId, m.user, childId, relationship),
    );
    await this.audit.log({
      action: 'users.link_child',
      entity: 'ChildGuardian',
      entityId: childId,
      daycareId: m.daycareId,
      metadata: { target: m.user.fullName, relationship },
    });
    return this.get(auth, membershipId);
  }

  async unlinkChild(
    auth: AuthContext,
    membershipId: string,
    childId: string,
  ): Promise<ManagedUser> {
    const m = await this.load(membershipId);
    this.assertScope(auth, m.daycareId, 'PARENT');
    await this.asActor(auth, (tx) =>
      tx.childGuardian.deleteMany({ where: { childId, userId: m.userId } }),
    );
    await this.audit.log({
      action: 'users.unlink_child',
      entity: 'ChildGuardian',
      entityId: childId,
      daycareId: m.daycareId,
      metadata: { target: m.user.fullName },
    });
    return this.get(auth, membershipId);
  }

  /** Move a child to another class (same branch) or — general admin only — another branch. */
  async moveChild(
    auth: AuthContext,
    childId: string,
    input: MoveChildInput,
  ): Promise<{ ok: true }> {
    const child = await this.prisma.raw.child.findFirst({
      where: { id: childId, deletedAt: null },
    });
    if (!child) throw new NotFoundException();
    this.assertScope(auth, child.daycareId, 'PARENT');
    const target = input.daycareId ?? child.daycareId;
    if (target !== child.daycareId && !this.isSuper(auth)) {
      throw new ForbiddenException({
        code: 'other_branch',
        message: 'Only a general admin can move a child to another branch',
      });
    }
    if (input.classroomId) {
      const cls = await this.prisma.raw.classroom.findFirst({
        where: { id: input.classroomId, daycareId: target, deletedAt: null },
      });
      if (!cls) throw new BadRequestException({ code: 'unknown_class', message: 'Unknown class' });
    }
    await this.asActor(auth, async (tx) => {
      await tx.child.update({
        where: { id: childId },
        data: {
          classroomId: input.classroomId ?? (target !== child.daycareId ? null : child.classroomId),
          daycareId: target,
        },
      });
      if (target !== child.daycareId)
        await tx.childGuardian.updateMany({ where: { childId }, data: { daycareId: target } });
    });
    if (target !== child.daycareId) {
      const guardians = await this.prisma.raw.childGuardian.findMany({
        where: { childId, userId: { not: null } },
      });
      for (const g of guardians) await this.links.ensureParent(g.userId!, target);
    }
    await this.audit.log({
      action: 'users.move_child',
      entity: 'Child',
      entityId: childId,
      daycareId: child.daycareId,
      metadata: { target: child.fullName, toBranch: target, toClass: input.classroomId ?? null },
    });
    return { ok: true };
  }

  /** Every add / edit / deactivate / delete / password reset (general admin). */
  async auditTrail(page: number, pageSize: number): Promise<Paginated<UserAuditEntry>> {
    const where: Prisma.AuditLogWhereInput = { action: { startsWith: 'users.' } };
    const [rows, total] = await Promise.all([
      this.prisma.raw.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(page, pageSize),
      }),
      this.prisma.raw.auditLog.count({ where }),
    ]);
    const actors = await this.prisma.raw.user.findMany({
      where: { id: { in: rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)) } },
      select: { id: true, fullName: true },
    });
    const branches = await this.prisma.raw.daycare.findMany({
      where: { id: { in: rows.map((r) => r.daycareId).filter((x): x is string => Boolean(x)) } },
      select: { id: true, name: true },
    });
    return paginate(
      rows.map((r) => {
        const meta = (r.metadata ?? null) as Record<string, unknown> | null;
        return {
          id: r.id,
          action: r.action,
          at: r.createdAt.toISOString(),
          actor: actors.find((a) => a.id === r.actorId)?.fullName ?? null,
          target: (meta?.target as string | undefined) ?? null,
          branch: branches.find((b) => b.id === r.daycareId)?.name ?? null,
          details: meta,
        };
      }),
      total,
      page,
      pageSize,
    );
  }
}
