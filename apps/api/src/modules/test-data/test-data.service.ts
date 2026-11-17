import { Injectable } from '@nestjs/common';
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
    await this.audit.log({ action: 'test_data.create', entity: 'Daycare', entityId: daycareId });
    return this.status();
  }

  /** Removes all TEST rows of the active branch (hard delete: test data only). */
  async clear() {
    const daycareId = requireTenantId();
    const testMembers = await this.prisma.raw.membership.findMany({
      where: { daycareId, isTest: true },
      select: { id: true, userId: true },
    });
    await this.prisma.raw.calendarEvent.deleteMany({
      where: { daycareId, title: { startsWith: 'TEST ·' } },
    });
    await this.prisma.raw.unit.deleteMany({ where: { daycareId, isTest: true } });
    await this.prisma.raw.child.deleteMany({ where: { daycareId, isTest: true } });
    await this.prisma.raw.classroom.deleteMany({ where: { daycareId, isTest: true } });
    await this.prisma.raw.membership.deleteMany({ where: { daycareId, isTest: true } });
    // Remove TEST users that no longer belong anywhere.
    await this.prisma.raw.user.deleteMany({
      where: { id: { in: testMembers.map((m) => m.userId) }, memberships: { none: {} } },
    });
    await this.audit.log({ action: 'test_data.clear', entity: 'Daycare', entityId: daycareId });
    return this.status();
  }
}
