import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Links guardians to parent accounts by email/phone, and gives the parent a
 * PARENT membership in the child's branch. Works both ways:
 * - staff saves a child whose guardian already has an account;
 * - a parent signs in with Google after the child was added.
 * Uses the raw client on purpose: it crosses branches for one user.
 */
@Injectable()
export class GuardianLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async ensureParentMembership(userId: string, daycareId: string): Promise<void> {
    const existing = await this.prisma.raw.membership.findFirst({ where: { userId, daycareId } });
    if (!existing) {
      await this.prisma.raw.membership.create({ data: { userId, daycareId, role: 'PARENT' } });
    } else if (existing.deletedAt && existing.role === 'PARENT') {
      await this.prisma.raw.membership.update({
        where: { id: existing.id },
        data: { deletedAt: null, status: 'ACTIVE' },
      });
    }
  }

  /** Called after a child's guardians are saved. */
  async linkChildGuardians(childId: string): Promise<void> {
    const guardians = await this.prisma.raw.childGuardian.findMany({ where: { childId } });
    for (const g of guardians) {
      if (!g.email && !g.phone) continue;
      const user = await this.prisma.raw.user.findFirst({
        where: {
          deletedAt: null,
          OR: [...(g.email ? [{ email: g.email }] : []), ...(g.phone ? [{ phone: g.phone }] : [])],
        },
      });
      if (!user) {
        if (g.userId)
          await this.prisma.raw.childGuardian.update({
            where: { id: g.id },
            data: { userId: null },
          });
        continue;
      }
      if (g.userId !== user.id) {
        await this.prisma.raw.childGuardian.update({
          where: { id: g.id },
          data: { userId: user.id },
        });
      }
      await this.ensureParentMembership(user.id, g.daycareId);
    }
  }

  /** Called on every sign-in: picks up children added before the parent signed up. */
  async linkUser(user: {
    id: string;
    email: string | null;
    phone: string | null;
  }): Promise<number> {
    const or = [
      ...(user.email ? [{ email: user.email }] : []),
      ...(user.phone ? [{ phone: user.phone }] : []),
    ];
    if (!or.length) return 0;
    const pending = await this.prisma.raw.childGuardian.findMany({
      where: { userId: null, OR: or, child: { deletedAt: null } },
    });
    for (const g of pending) {
      await this.prisma.raw.childGuardian.update({
        where: { id: g.id },
        data: { userId: user.id },
      });
      await this.ensureParentMembership(user.id, g.daycareId);
    }
    if (pending.length) {
      await this.audit.log({
        action: 'parent.linked',
        entity: 'User',
        entityId: user.id,
        actorId: user.id,
        daycareId: null,
        metadata: { guardians: pending.map((g) => g.id) },
      });
    }
    return pending.length;
  }
}
