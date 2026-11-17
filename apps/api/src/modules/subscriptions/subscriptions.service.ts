import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  localDate,
  paginate,
  type CreateSubscriptionInput,
  type PlanDto,
  type PlanInput,
  type SubscriptionDto,
  type SubscriptionListQuery,
  type SubscriptionListResponse,
} from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { pageArgs, requireBranch } from '../../common/utils/scope';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dbDate } from '../attendance/attendance.util';
import { AuditService } from '../audit/audit.service';

const include = {
  child: {
    select: {
      id: true,
      fullName: true,
      status: true,
      photoKey: true,
      classroom: { select: { name: true } },
    },
  },
  plan: { select: { id: true, name: true } },
} satisfies Prisma.SubscriptionInclude;
type Row = Prisma.SubscriptionGetPayload<{ include: typeof include }>;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDto = (s: Row): SubscriptionDto => ({
  id: s.id,
  child: {
    id: s.child.id,
    fullName: s.child.fullName,
    status: s.child.status,
    classroom: s.child.classroom?.name ?? null,
    hasPhoto: Boolean(s.child.photoKey),
  },
  plan: s.plan,
  value: Number(s.value),
  startDate: iso(s.startDate),
  endDate: iso(s.endDate),
  paymentStatus: s.paymentStatus,
  paymentMethod: s.paymentMethod,
  // A subscription past its end date reads as ended.
  status: s.status === 'ACTIVE' && iso(s.endDate) < localDate() ? 'ENDED' : s.status,
  paidAt: s.paidAt?.toISOString() ?? null,
  lastRemindedAt: s.lastRemindedAt?.toISOString() ?? null,
  reminders: s.reminders,
  notes: s.notes,
});

/** Branch fees paid on-site: staff record payments; "Remind" messages the family. */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- plans ----------------

  async plans(): Promise<PlanDto[]> {
    const plans = await this.prisma.scoped.plan.findMany({ orderBy: { createdAt: 'asc' } });
    const counts = await this.prisma.scoped.subscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _count: true,
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      period: p.period,
      services: p.services,
      activeCount: counts.find((c) => c.planId === p.id)?._count ?? 0,
    }));
  }

  async createPlan(input: PlanInput) {
    const p = await this.prisma.scoped.plan.create({ data: { ...input } as never });
    await this.audit.log({ action: 'plan.create', entity: 'Plan', entityId: p.id });
    return (await this.plans()).find((x) => x.id === p.id)!;
  }

  async updatePlan(id: string, input: PlanInput) {
    await this.prisma.scoped.plan.findFirstOrThrow({ where: { id } });
    await this.prisma.scoped.plan.update({ where: { id }, data: input });
    await this.audit.log({ action: 'plan.update', entity: 'Plan', entityId: id });
    return (await this.plans()).find((x) => x.id === id)!;
  }

  async deletePlan(id: string) {
    await this.prisma.scoped.plan.findFirstOrThrow({ where: { id } });
    await this.prisma.scoped.plan.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ action: 'plan.delete', entity: 'Plan', entityId: id });
    return { ok: true };
  }

  // ---------------- subscriptions ----------------

  async list(q: SubscriptionListQuery): Promise<SubscriptionListResponse> {
    const today = localDate();
    const since = (days: number) => {
      const d = dbDate(today);
      d.setUTCDate(d.getUTCDate() - days);
      return d;
    };
    const periodFrom =
      q.period === 'today'
        ? since(0)
        : q.period === 'week'
          ? since(7)
          : q.period === 'month'
            ? since(31)
            : q.period === 'year'
              ? since(366)
              : undefined;
    const base: Prisma.SubscriptionWhereInput = {
      AND: [
        q.search ? { child: { fullName: { contains: q.search, mode: 'insensitive' } } } : {},
        q.classroomId ? { child: { classroomId: q.classroomId } } : {},
        q.accountStatus ? { child: { status: q.accountStatus } } : {},
        q.planId ? { planId: q.planId } : {},
        periodFrom ? { startDate: { gte: periodFrom } } : {},
      ],
    };
    const where: Prisma.SubscriptionWhereInput = {
      AND: [
        base,
        q.paymentStatus ? { paymentStatus: q.paymentStatus, status: { not: 'CANCELED' } } : {},
        q.status === 'ENDED'
          ? { OR: [{ status: 'ENDED' }, { status: 'ACTIVE', endDate: { lt: dbDate(today) } }] }
          : q.status === 'ACTIVE'
            ? { status: 'ACTIVE', endDate: { gte: dbDate(today) } }
            : q.status
              ? { status: q.status }
              : {},
      ],
    };
    const [rows, total, all, reminded] = await Promise.all([
      this.prisma.scoped.subscription.findMany({
        where,
        include,
        // Unpaid first, then newest.
        orderBy: [{ paymentStatus: 'desc' }, { startDate: 'desc' }],
        ...pageArgs(q.page, q.pageSize),
      }),
      this.prisma.scoped.subscription.count({ where }),
      this.prisma.scoped.subscription.findMany({
        where: base,
        select: { paymentStatus: true, status: true, value: true },
      }),
      this.prisma.scoped.subscription.findMany({
        where: { lastRemindedAt: { not: null } },
        include: { child: { select: { fullName: true } } },
        orderBy: { lastRemindedAt: 'desc' },
        take: 8,
      }),
    ]);
    const live = all.filter((s) => s.status !== 'CANCELED');
    return {
      ...paginate(rows.map(toDto), total, q.page, q.pageSize),
      summary: {
        total: all.length,
        paid: live.filter((s) => s.paymentStatus === 'PAID').length,
        unpaid: live.filter((s) => s.paymentStatus === 'UNPAID').length,
        canceled: all.length - live.length,
        unpaidAmount: live
          .filter((s) => s.paymentStatus === 'UNPAID')
          .reduce((n, s) => n + Number(s.value), 0),
      },
      reminders: reminded.map((s) => ({
        subscriptionId: s.id,
        childName: s.child.fullName,
        at: s.lastRemindedAt!.toISOString(),
        count: s.reminders,
      })),
    };
  }

  async create(input: CreateSubscriptionInput): Promise<SubscriptionDto> {
    await this.prisma.scoped.child.findFirstOrThrow({ where: { id: input.childId } });
    if (input.planId)
      await this.prisma.scoped.plan.findFirstOrThrow({ where: { id: input.planId } });
    const s = await this.prisma.scoped.subscription.create({
      data: {
        childId: input.childId,
        planId: input.planId ?? null,
        value: input.value,
        startDate: dbDate(input.startDate),
        endDate: dbDate(input.endDate),
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentStatus === 'PAID' ? (input.paymentMethod ?? 'CASH') : null,
        paidAt: input.paymentStatus === 'PAID' ? new Date() : null,
        notes: input.notes || null,
      } as never,
      include,
    });
    await this.audit.log({ action: 'subscription.create', entity: 'Subscription', entityId: s.id });
    return toDto(s);
  }

  private async load(id: string): Promise<Row> {
    const s = await this.prisma.scoped.subscription.findFirst({ where: { id }, include });
    if (!s) throw new NotFoundException();
    return s;
  }

  async markPaid(id: string, method: 'CASH' | 'CARD' | 'TRANSFER'): Promise<SubscriptionDto> {
    const s = await this.load(id);
    if (s.status === 'CANCELED')
      throw new BadRequestException({ code: 'subscription_canceled', message: 'Canceled' });
    const u = await this.prisma.scoped.subscription.update({
      where: { id },
      data: { paymentStatus: 'PAID', paymentMethod: method, paidAt: new Date() },
      include,
    });
    await this.audit.log({
      action: 'subscription.mark_paid',
      entity: 'Subscription',
      entityId: id,
      metadata: { method },
    });
    return toDto(u);
  }

  /** Sends a payment reminder to the family in the child's chat thread. */
  async remind(auth: AuthContext, id: string): Promise<SubscriptionDto> {
    const s = await this.load(id);
    if (s.paymentStatus === 'PAID')
      throw new BadRequestException({ code: 'already_paid', message: 'Already paid' });
    const daycareId = requireBranch(auth);
    const thread =
      (await this.prisma.raw.messageThread.findFirst({
        where: { daycareId, kind: 'CHILD', childId: s.childId },
      })) ??
      (await this.prisma.raw.messageThread.create({
        data: { daycareId, kind: 'CHILD', childId: s.childId, createdById: auth.userId },
      }));
    const value = Number(s.value).toLocaleString('en-US');
    await this.prisma.raw.message.create({
      data: {
        daycareId,
        threadId: thread.id,
        senderId: auth.userId,
        body: `🔔 تذكير بسداد اشتراك ${s.child.fullName}${s.plan ? ` (${s.plan.name})` : ''}: ${value} ر.س للفترة ${iso(s.startDate)} – ${iso(s.endDate)}. يرجى السداد في الفرع. شكرًا لكم.`,
      },
    });
    await this.prisma.raw.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
    const u = await this.prisma.scoped.subscription.update({
      where: { id },
      data: { lastRemindedAt: new Date(), reminders: { increment: 1 } },
      include,
    });
    await this.audit.log({ action: 'subscription.remind', entity: 'Subscription', entityId: id });
    return toDto(u);
  }

  async cancel(id: string): Promise<SubscriptionDto> {
    await this.load(id);
    const u = await this.prisma.scoped.subscription.update({
      where: { id },
      data: { status: 'CANCELED' },
      include,
    });
    await this.audit.log({ action: 'subscription.cancel', entity: 'Subscription', entityId: id });
    return toDto(u);
  }

  async archiveChild(id: string): Promise<SubscriptionDto> {
    const s = await this.load(id);
    await this.prisma.scoped.child.update({
      where: { id: s.childId },
      data: { status: 'ARCHIVED' },
    });
    await this.audit.log({ action: 'child.archive', entity: 'Child', entityId: s.childId });
    return toDto(await this.load(id));
  }

  /** Parent: own children's subscriptions (read-only, all branches). */
  async mine(userId: string): Promise<SubscriptionDto[]> {
    const rows = await this.prisma.raw.subscription.findMany({
      where: { deletedAt: null, child: { deletedAt: null, guardians: { some: { userId } } } },
      include,
      orderBy: { startDate: 'desc' },
      take: 50,
    });
    return rows.map(toDto);
  }
}
