import { Injectable } from '@nestjs/common';
import { localDate } from '@latif/shared';
import { dbDate } from '../attendance/attendance.util';
import { requireTenantId } from '../../prisma/tenancy';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const KIDS: [string, 'MALE' | 'FEMALE'][] = [
  ['ليان', 'FEMALE'],
  ['يوسف', 'MALE'],
  ['سارة', 'FEMALE'],
  ['عمر', 'MALE'],
  ['جود', 'FEMALE'],
  ['فيصل', 'MALE'],
  ['ريم', 'FEMALE'],
  ['خالد', 'MALE'],
  ['نورة', 'FEMALE'],
  ['سلمان', 'MALE'],
  ['لمى', 'FEMALE'],
  ['تركي', 'MALE'],
];
const LAST = ['العتيبي', 'القحطاني', 'الشهري', 'الدوسري', 'الحربي', 'الزهراني'];
const TEACHERS = ['أ. هدى', 'أ. منيرة', 'أ. أمل', 'أ. ريما'];
const CLASSES = [
  { name: 'TEST · العصافير', capacity: 12, minAgeMonths: 18, maxAgeMonths: 30, color: '#5b6db4' },
  { name: 'TEST · الفراشات', capacity: 15, minAgeMonths: 30, maxAgeMonths: 48, color: '#7b649b' },
  { name: 'TEST · النجوم', capacity: 15, minAgeMonths: 48, maxAgeMonths: 72, color: '#2fb36d' },
];

/**
 * Admin-only TEST data for the active branch. Everything is flagged isTest and
 * names start with "TEST" so it is obvious on screen and removable in one click.
 */
@Injectable()
export class TestDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async status() {
    const [classes, children, staff, units] = await Promise.all([
      this.prisma.scoped.classroom.count({ where: { isTest: true } }),
      this.prisma.scoped.child.count({ where: { isTest: true } }),
      this.prisma.scoped.membership.count({ where: { isTest: true } }),
      this.prisma.scoped.unit.count({ where: { isTest: true } }),
    ]);
    return { classes, children, staff, units };
  }

  async create() {
    const daycareId = requireTenantId();
    const branch = await this.prisma.raw.daycare.findUniqueOrThrow({ where: { id: daycareId } });
    const tag = branch.slug.replace(/[^a-z0-9]/g, '');
    const run = Date.now().toString(36);

    const teacherIds: string[] = [];
    for (const [i, name] of TEACHERS.entries()) {
      const user = await this.prisma.raw.user.create({
        data: {
          fullName: `TEST ${name}`,
          email: `test.teacher${i + 1}.${tag}.${run}@test.latifkids.invalid`,
        },
      });
      const m = await this.prisma.scoped.membership.create({
        data: {
          userId: user.id,
          role: 'STAFF',
          staffType: i === 3 ? 'ASSISTANT' : 'TEACHER',
          specialties: [['لغة عربية', 'تربية إسلامية', 'فنون', 'رياضة'][i]!],
          permissions: ['canViewMessages', 'canManageAttendance'],
          joinDate: new Date(),
          isTest: true,
        } as never,
      });
      teacherIds.push(m.id);
    }

    const classIds: string[] = [];
    for (const [i, c] of CLASSES.entries()) {
      const room = await this.prisma.scoped.classroom.create({
        data: { ...c, isTest: true } as never,
      });
      classIds.push(room.id);
      await this.prisma.scoped.classTeacher.create({
        data: { classroomId: room.id, membershipId: teacherIds[i]! } as never,
      });
    }

    const now = new Date();
    const childIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const classIndex = i % 3;
      const ageMonths = [24, 38, 60][classIndex]! + (i % 4);
      const birth = new Date(now.getFullYear(), now.getMonth() - ageMonths, 1 + (i % 27));
      const last = LAST[i % LAST.length]!;
      const child = await this.prisma.scoped.child.create({
        data: {
          fullName: `TEST ${KIDS[i]![0]} ${last}`,
          gender: KIDS[i]![1],
          birthDate: birth,
          classroomId: classIds[classIndex],
          allergies: i % 5 === 0 ? 'فول سوداني' : null,
          isTest: true,
        } as never,
      });
      childIds.push(child.id);
      await this.prisma.scoped.childGuardian.create({
        data: {
          childId: child.id,
          fullName: `TEST ولي أمر ${last}`,
          relationship: i % 3 ? 'أم' : 'أب',
          phone: `+9665${String(10000000 + i * 7919).slice(0, 8)}`,
          isPrimary: true,
        } as never,
      });
    }
    // Curriculum units with lessons/activities, and this week's calendar items.
    const units = [
      {
        name: 'TEST · وحدة الماء',
        color: '#5b6db4',
        lessons: ['التعرف على الماء', 'مصادر الماء'],
        activities: ['تجربة الطفو', 'رسم البحر'],
      },
      {
        name: 'TEST · وحدة الفضاء',
        color: '#7b649b',
        lessons: ['الشمس والقمر', 'الكواكب'],
        activities: ['صنع صاروخ'],
      },
    ];
    const unitIds: string[] = [];
    for (const u of units) {
      const unit = await this.prisma.scoped.unit.create({
        data: {
          name: u.name,
          color: u.color,
          goals: ['اكتشاف', 'تواصل'],
          startDate: new Date(),
          isTest: true,
        } as never,
      });
      unitIds.push(unit.id);
      let order = 0;
      for (const title of u.lessons) {
        await this.prisma.scoped.unitItem.create({
          data: { unitId: unit.id, kind: 'LESSON', title, sortOrder: order++ } as never,
        });
      }
      for (const title of u.activities) {
        await this.prisma.scoped.unitItem.create({
          data: { unitId: unit.id, kind: 'ACTIVITY', title, sortOrder: order++ } as never,
        });
      }
    }
    const day = (offset: number) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + offset);
      return d;
    };
    const events = [
      {
        title: 'TEST · درس الماء',
        type: 'LESSON',
        audience: 'CLASS',
        classroomId: classIds[0],
        unitId: unitIds[0],
        teacherId: teacherIds[0],
        offset: 0,
        startTime: '08:30',
        endTime: '09:15',
      },
      {
        title: 'TEST · نشاط الرسم',
        type: 'ACTIVITY',
        audience: 'CLASS',
        classroomId: classIds[1],
        unitId: unitIds[0],
        teacherId: teacherIds[1],
        offset: 1,
        startTime: '10:00',
        endTime: '10:45',
      },
      {
        title: 'TEST · اجتماع أولياء الأمور',
        type: 'MEETING',
        audience: 'BRANCH',
        offset: 2,
        startTime: '16:00',
        endTime: '17:00',
      },
      { title: 'TEST · رحلة الحديقة', type: 'TRIP', audience: 'BRANCH', offset: 3 },
    ] as const;
    for (const e of events) {
      await this.prisma.raw.calendarEvent.create({
        data: {
          daycareId,
          title: e.title,
          type: e.type,
          audience: e.audience,
          classroomId: 'classroomId' in e ? e.classroomId : null,
          unitId: 'unitId' in e ? e.unitId : null,
          teacherId: 'teacherId' in e ? e.teacherId : null,
          startDate: day(e.offset),
          endDate: day(e.offset),
          startTime: 'startTime' in e ? e.startTime : null,
          endTime: 'endTime' in e ? e.endTime : null,
        },
      });
    }
    // Today's attendance (fills the dashboard donut): most present, a few absent / on vacation / left.
    const today = dbDate(localDate());
    for (const [i, childId] of childIds.entries()) {
      if (i % 6 === 5) continue; // no record yet
      const status = i % 6 === 4 ? 'ABSENT' : i % 6 === 3 ? 'VACATION' : 'ATTENDED';
      await this.prisma.raw.childAttendance.upsert({
        where: { childId_date: { childId, date: today } },
        update: {},
        create: {
          daycareId,
          childId,
          date: today,
          status,
          checkInAt: status === 'ATTENDED' ? new Date(Date.now() - (3 + i) * 600_000) : null,
          checkOutAt: status === 'ATTENDED' && i % 6 === 2 ? new Date() : null,
          droppedOffBy: status === 'ATTENDED' ? 'الأم' : null,
          method: 'MANUAL',
        },
      });
    }
    // A fee plan with this month's subscriptions (some unpaid), and today's shared daily reports.
    const plan = await this.prisma.scoped.plan.create({
      data: {
        name: 'TEST · خطة شهرية',
        price: 1800,
        period: 'MONTHLY',
        services: ['وجبات', 'أنشطة'],
        isTest: true,
      } as never,
    });
    const monthStart = `${localDate().slice(0, 8)}01`;
    const monthEnd = new Date(
      Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10);
    for (const [i, childId] of childIds.entries()) {
      const paid = i % 3 !== 0;
      await this.prisma.scoped.subscription.create({
        data: {
          childId,
          planId: plan.id,
          value: 1800,
          startDate: dbDate(monthStart),
          endDate: dbDate(monthEnd),
          paymentStatus: paid ? 'PAID' : 'UNPAID',
          paymentMethod: paid ? (['CASH', 'CARD', 'TRANSFER'] as const)[i % 3] : null,
          paidAt: paid ? new Date() : null,
          isTest: true,
        } as never,
      });
      if (i % 2 === 0) {
        await this.prisma.scoped.dailyReport.create({
          data: {
            childId,
            date: today,
            meals: [
              { meal: 'BREAKFAST', amount: 'ALL' },
              { meal: 'LUNCH', amount: i % 4 ? 'MOST' : 'ALL' },
            ],
            napMinutes: 45 + (i % 3) * 15,
            toilet: 2,
            mood: (['HAPPY', 'CALM', 'TIRED'] as const)[i % 3],
            activities: 'رسم، قصة، لعب في الساحة',
            sharedAt: new Date(),
            isTest: true,
          } as never,
        });
      }
    }
    // A welcome announcement in Messages.
    const thread = await this.prisma.raw.messageThread.create({
      data: { daycareId, kind: 'ANNOUNCEMENT', title: 'TEST · أهلًا بكم في لطيف كيدز' },
    });
    const author = await this.prisma.raw.membership.findFirst({
      where: { daycareId, isTest: true },
    });
    if (author) {
      await this.prisma.raw.message.create({
        data: {
          daycareId,
          threadId: thread.id,
          senderId: author.userId,
          body: 'هذه رسالة تجريبية (TEST). يمكن حذف كل البيانات التجريبية من الإعدادات.',
        },
      });
    }
    await this.audit.log({ action: 'test_data.create', entity: 'Daycare', entityId: daycareId });
    return this.status();
  }

  /** Removes all TEST rows of the active branch (hard delete: test data only). */
  async clear() {
    await this.clearBranch(requireTenantId());
    return this.status();
  }

  /** General admin: removes the TEST / sample rows of every branch in one go. */
  async clearAll() {
    const branches = await this.prisma.raw.daycare.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const b of branches) await this.clearBranch(b.id);
    return { branches: branches.length };
  }

  private async clearBranch(daycareId: string) {
    const testMembers = await this.prisma.raw.membership.findMany({
      where: { daycareId, isTest: true },
      select: { id: true, userId: true },
    });
    // Items made by the TEST / sample accounts (demo events, conversations, admission requests).
    const testUserIds = testMembers.map((m) => m.userId);
    await this.prisma.raw.calendarEvent.deleteMany({
      where: {
        daycareId,
        OR: [{ title: { startsWith: 'TEST ·' } }, { createdById: { in: testUserIds } }],
      },
    });
    await this.prisma.raw.admissionRequest.deleteMany({
      where: { daycareId, requestedById: { in: testUserIds } },
    });
    const testKids = await this.prisma.raw.child.findMany({
      where: { daycareId, isTest: true },
      select: { id: true },
    });
    await this.prisma.raw.messageThread.deleteMany({
      where: {
        daycareId,
        OR: [
          { title: { startsWith: 'TEST ·' } },
          { childId: { in: testKids.map((k) => k.id) } },
          { createdById: { in: testUserIds } },
        ],
      },
    });
    await this.prisma.raw.unit.deleteMany({ where: { daycareId, isTest: true } });
    await this.prisma.raw.plan.deleteMany({ where: { daycareId, isTest: true } });
    await this.prisma.raw.child.deleteMany({ where: { daycareId, isTest: true } });
    await this.prisma.raw.classroom.deleteMany({ where: { daycareId, isTest: true } });
    await this.prisma.raw.membership.deleteMany({ where: { daycareId, isTest: true } });
    // Remove TEST users that no longer belong anywhere.
    await this.prisma.raw.user.deleteMany({
      where: { id: { in: testMembers.map((m) => m.userId) }, memberships: { none: {} } },
    });
    await this.audit.log({
      action: 'test_data.clear',
      entity: 'Daycare',
      entityId: daycareId,
      daycareId,
    });
  }
}
