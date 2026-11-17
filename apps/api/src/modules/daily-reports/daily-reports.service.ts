import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { localDate, type DailyReportDto, type DailyReportInput } from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { isBranchAdmin, requireBranch } from '../../common/utils/scope';
import type { Prisma } from '../../generated/prisma/client';
import { branchesWithModuleOff } from '../../common/utils/modules';
import { PrismaService } from '../../prisma/prisma.service';
import { dbDate } from '../attendance/attendance.util';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';

type Meal = DailyReportDto['meals'][number];
const MEAL = { BREAKFAST: 'الفطور', SNACK: 'الوجبة الخفيفة', LUNCH: 'الغداء' } as const;
const AMOUNT = {
  ALL: 'أكل كل الوجبة',
  MOST: 'أكل أغلبها',
  SOME: 'أكل قليلًا',
  NONE: 'لم يأكل',
} as const;
const MOOD = {
  HAPPY: 'سعيد 😊',
  CALM: 'هادئ 🙂',
  TIRED: 'متعب 😴',
  SAD: 'حزين 😢',
  UPSET: 'منزعج 😣',
} as const;

/** Daily report text posted in the child's chat when shared with the family. */
export const reportText = (
  name: string,
  r: Pick<
    DailyReportDto,
    'date' | 'meals' | 'napMinutes' | 'toilet' | 'mood' | 'activities' | 'notes'
  >,
) =>
  [
    `📒 التقرير اليومي لـ ${name} — ${r.date}`,
    ...r.meals.map((m: Meal) => `🍽️ ${MEAL[m.meal]}: ${AMOUNT[m.amount]}`),
    r.napMinutes != null ? `😴 القيلولة: ${r.napMinutes} دقيقة` : null,
    r.toilet != null ? `🚻 دورة المياه: ${r.toilet} مرات` : null,
    r.mood ? `💛 المزاج: ${MOOD[r.mood]}` : null,
    r.activities ? `🎨 الأنشطة: ${r.activities}` : null,
    r.notes ? `📝 ملاحظات: ${r.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
  ) {}

  private async visibility(auth: AuthContext): Promise<Prisma.ChildWhereInput> {
    if (isBranchAdmin(auth)) return {};
    if (auth.role !== 'STAFF') throw new ForbiddenException();
    return { classroomId: { in: await this.classes.teacherClassIds(auth) } };
  }

  /** Staff: every visible child for a day, with the report if written. */
  async day(
    auth: AuthContext,
    date = localDate(),
    classroomId?: string,
  ): Promise<DailyReportDto[]> {
    const children = await this.prisma.scoped.child.findMany({
      where: {
        AND: [
          await this.visibility(auth),
          { status: 'ACTIVE' },
          classroomId ? { classroomId } : {},
        ],
      },
      include: { classroom: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
    });
    const reports = await this.prisma.scoped.dailyReport.findMany({
      where: { date: dbDate(date), childId: { in: children.map((c) => c.id) } },
    });
    const authors = await this.authorNames(reports.map((r) => r.authorId));
    return children.map((c) => {
      const r = reports.find((x) => x.childId === c.id);
      return this.toDto(c, date, r, authors);
    });
  }

  private async authorNames(ids: (string | null)[]) {
    const users = await this.prisma.raw.user.findMany({
      where: { id: { in: ids.filter((x): x is string => Boolean(x)) } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  private toDto(
    c: {
      id: string;
      fullName: string;
      photoKey: string | null;
      classroom: { name: string } | null;
    },
    date: string,
    r: Prisma.DailyReportGetPayload<object> | undefined,
    authors: Map<string, string>,
  ): DailyReportDto {
    return {
      id: r?.id ?? null,
      child: {
        id: c.id,
        fullName: c.fullName,
        classroom: c.classroom?.name ?? null,
        hasPhoto: Boolean(c.photoKey),
      },
      date,
      meals: (r?.meals as DailyReportDto['meals'] | undefined) ?? [],
      napMinutes: r?.napMinutes ?? null,
      toilet: r?.toilet ?? null,
      mood: r?.mood ?? null,
      activities: r?.activities ?? null,
      notes: r?.notes ?? null,
      author: r?.authorId ? (authors.get(r.authorId) ?? null) : null,
      sharedAt: r?.sharedAt?.toISOString() ?? null,
      updatedAt: r?.updatedAt.toISOString() ?? null,
    };
  }

  async save(auth: AuthContext, input: DailyReportInput): Promise<DailyReportDto> {
    const daycareId = requireBranch(auth);
    const child = await this.prisma.scoped.child.findFirst({
      where: { AND: [await this.visibility(auth), { id: input.childId }] },
      include: { classroom: { select: { name: true } } },
    });
    if (!child) throw new NotFoundException();
    const data = {
      meals: input.meals,
      napMinutes: input.napMinutes ?? null,
      toilet: input.toilet ?? null,
      mood: input.mood ?? null,
      activities: input.activities || null,
      notes: input.notes || null,
      authorId: auth.userId,
      ...(input.share ? { sharedAt: new Date() } : {}),
    };
    const r = await this.prisma.scoped.dailyReport.upsert({
      where: { childId_date: { childId: child.id, date: dbDate(input.date) } },
      update: data,
      create: { ...data, childId: child.id, date: dbDate(input.date) } as never,
    });
    const dto = this.toDto(child, input.date, r, await this.authorNames([auth.userId]));
    if (input.share) {
      const thread =
        (await this.prisma.raw.messageThread.findFirst({
          where: { daycareId, kind: 'CHILD', childId: child.id },
        })) ??
        (await this.prisma.raw.messageThread.create({
          data: { daycareId, kind: 'CHILD', childId: child.id, createdById: auth.userId },
        }));
      await this.prisma.raw.message.create({
        data: {
          daycareId,
          threadId: thread.id,
          senderId: auth.userId,
          body: reportText(child.fullName, dto),
        },
      });
      await this.prisma.raw.messageThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: new Date() },
      });
    }
    await this.audit.log({
      action: input.share ? 'daily_report.share' : 'daily_report.save',
      entity: 'DailyReport',
      entityId: r.id,
    });
    return dto;
  }

  /** Parent: shared reports of own children (latest first). */
  async mine(userId: string): Promise<DailyReportDto[]> {
    const off = await branchesWithModuleOff(this.prisma, 'dailyReports');
    const rows = await this.prisma.raw.dailyReport.findMany({
      where: {
        sharedAt: { not: null },
        daycareId: { notIn: off },
        child: { deletedAt: null, guardians: { some: { userId } } },
      },
      include: { child: { include: { classroom: { select: { name: true } } } } },
      orderBy: [{ date: 'desc' }],
      take: 60,
    });
    const authors = await this.authorNames(rows.map((r) => r.authorId));
    return rows.map((r) => this.toDto(r.child, r.date.toISOString().slice(0, 10), r, authors));
  }
}
