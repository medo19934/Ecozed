import { Injectable, Logger } from '@nestjs/common';
import { BRANCHES, localDate, type DemoAccount } from '@latif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { dbDate } from '../attendance/attendance.util';

const DOMAIN = 'latifkids.demo';
export const DEMO_ADMIN = `admin@${DOMAIN}`;
const short = (slug: string) => slug.replace('al-', '');

type BranchPeople = { manager: string; teacher: string; parent: string };
const PEOPLE: Record<
  string,
  { manager: string; teacher: string; parent: string; kids: [string, 'MALE' | 'FEMALE'][] }
> = {
  'al-malqa': {
    manager: 'أ. نورة القحطاني',
    teacher: 'أ. هدى الحربي',
    parent: 'سارة العتيبي',
    kids: [
      ['ليان العتيبي', 'FEMALE'],
      ['يوسف العتيبي', 'MALE'],
      ['جود الشهري', 'FEMALE'],
      ['عمر الدوسري', 'MALE'],
      ['ريم الزهراني', 'FEMALE'],
      ['فيصل المطيري', 'MALE'],
      ['لمى الغامدي', 'FEMALE'],
      ['تركي السبيعي', 'MALE'],
    ],
  },
  'al-rayan': {
    manager: 'أ. منيرة الشمري',
    teacher: 'أ. أمل الرشيدي',
    parent: 'هند القرني',
    kids: [
      ['سلمان القرني', 'MALE'],
      ['نورة القرني', 'FEMALE'],
      ['خالد العنزي', 'MALE'],
      ['هيا البقمي', 'FEMALE'],
      ['راكان الحارثي', 'MALE'],
      ['دانة العمري', 'FEMALE'],
      ['ماجد اليامي', 'MALE'],
    ],
  },
  olaya: {
    manager: 'أ. ريما الدوسري',
    teacher: 'أ. عبير السالم',
    parent: 'منال الشهراني',
    kids: [
      ['تالا الشهراني', 'FEMALE'],
      ['عبدالله الشهراني', 'MALE'],
      ['جنى الفيفي', 'FEMALE'],
      ['سعود العسيري', 'MALE'],
      ['لين المالكي', 'FEMALE'],
      ['زياد الحربي', 'MALE'],
    ],
  },
};
const CLASSES = [
  { name: 'العصافير', capacity: 12, minAgeMonths: 18, maxAgeMonths: 30, color: '#5b6db4' },
  { name: 'الفراشات', capacity: 15, minAgeMonths: 30, maxAgeMonths: 48, color: '#7b649b' },
  { name: 'النجوم', capacity: 15, minAgeMonths: 48, maxAgeMonths: 72, color: '#2fb36d' },
];

/**
 * PUBLIC_DEMO data: one general admin, and per branch a manager, a teacher and a
 * parent with real-looking classes, children, units, calendar, attendance and messages.
 * Created once (idempotent); marked isTest so admins can clear it from Settings.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(private readonly prisma: PrismaService) {}

  emails(slug: string): BranchPeople {
    return {
      manager: `manager.${short(slug)}@${DOMAIN}`,
      teacher: `teacher.${short(slug)}@${DOMAIN}`,
      parent: `parent.${short(slug)}@${DOMAIN}`,
    };
  }

  async accounts(): Promise<DemoAccount[]> {
    const branches = await this.prisma.raw.daycare.findMany({ where: { deletedAt: null } });
    const out: DemoAccount[] = [
      { email: DEMO_ADMIN, role: 'SUPER_ADMIN', name: 'الإدارة العامة', branch: null },
    ];
    for (const b of BRANCHES) {
      const branch = branches.find((x) => x.slug === b.slug);
      if (!branch) continue;
      const e = this.emails(b.slug);
      const p = PEOPLE[b.slug]!;
      const info = { slug: b.slug, name: branch.name, nameEn: branch.nameEn };
      out.push({ email: e.manager, role: 'MANAGER', name: p.manager, branch: info });
      out.push({ email: e.teacher, role: 'STAFF', name: p.teacher, branch: info });
      out.push({ email: e.parent, role: 'PARENT', name: p.parent, branch: info });
    }
    return out;
  }

  async seed(): Promise<void> {
    // Demo branches show every feature (except paid AI), also when the data already exists.
    for (const branch of await this.prisma.raw.daycare.findMany({ where: { deletedAt: null } })) {
      for (const key of ['messages', 'childQrAttendance', 'staffGeofencedAttendance']) {
        await this.prisma.raw.daycareFeature.upsert({
          where: { daycareId_key: { daycareId: branch.id, key } },
          create: { daycareId: branch.id, key, enabled: true },
          update: { enabled: true },
        });
      }
    }
    if (await this.prisma.raw.user.findFirst({ where: { email: DEMO_ADMIN } })) return;
    // One transaction: a cold start that times out leaves nothing half-created.
    await this.prisma.raw.$transaction(
      async (db) => {
        await db.user.create({
          data: { email: DEMO_ADMIN, fullName: 'الإدارة العامة', isSuperAdmin: true },
        });
        const today = localDate();
        const day = (offset: number) => {
          const d = dbDate(today);
          d.setUTCDate(d.getUTCDate() + offset);
          return d;
        };

        for (const b of BRANCHES) {
          const branch = await db.daycare.findFirst({ where: { slug: b.slug } });
          if (!branch) continue;
          const daycareId = branch.id;
          const p = PEOPLE[b.slug]!;
          const e = this.emails(b.slug);
          await db.daycare.update({
            where: { id: daycareId },
            data: {
              latitude: branch.latitude ?? 24.77,
              longitude: branch.longitude ?? 46.64,
              phone: branch.phone ?? '+966112345678',
            },
          });

          const manager = await db.user.create({
            data: {
              email: e.manager,
              fullName: p.manager,
              lastDaycareId: daycareId,
              memberships: {
                create: {
                  daycareId,
                  role: 'MANAGER',
                  staffType: 'ADMIN',
                  isTest: true,
                  joinDate: day(-400),
                },
              },
            },
            include: { memberships: true },
          });
          const teacher = await db.user.create({
            data: {
              email: e.teacher,
              fullName: p.teacher,
              lastDaycareId: daycareId,
              memberships: {
                create: {
                  daycareId,
                  role: 'STAFF',
                  staffType: 'TEACHER',
                  specialties: ['لغة عربية', 'فنون'],
                  qualification: 'بكالوريوس رياض أطفال',
                  permissions: ['canViewMessages', 'canManageAttendance', 'canAddChild'],
                  isTest: true,
                  joinDate: day(-200),
                },
              },
            },
            include: { memberships: true },
          });
          const parent = await db.user.create({
            data: { email: e.parent, fullName: p.parent, lastDaycareId: daycareId },
          });
          await db.membership.create({
            data: { daycareId, userId: parent.id, role: 'PARENT', isTest: true },
          });

          const classIds: string[] = [];
          for (const c of CLASSES) {
            const room = await db.classroom.create({ data: { ...c, daycareId, isTest: true } });
            classIds.push(room.id);
          }
          const teacherMembership = teacher.memberships[0]!.id;
          for (const classroomId of classIds.slice(0, 2)) {
            await db.classTeacher.create({
              data: { daycareId, classroomId, membershipId: teacherMembership },
            });
          }

          const childIds: string[] = [];
          for (const [i, [name, gender]] of p.kids.entries()) {
            const months = [26, 38, 60][i % 3]! + (i % 5);
            const birth = new Date(
              Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth() - months,
                1 + ((i * 3) % 27),
              ),
            );
            const isParentsChild = i < 2;
            const child = await db.child.create({
              data: {
                daycareId,
                fullName: name,
                gender,
                birthDate: birth,
                // The demo parent's two children are both in the teacher's class.
                classroomId: isParentsChild ? classIds[0] : classIds[i % 3],
                allergies: i === 3 ? 'فول سوداني' : null,
                pickupPeople: [
                  { name: 'السائق أحمد', relationship: 'سائق', phone: '+966511111111' },
                ],
                isTest: true,
              },
            });
            childIds.push(child.id);
            await db.childGuardian.create({
              data: {
                daycareId,
                childId: child.id,
                fullName: isParentsChild ? p.parent : `ولي أمر ${name.split(' ')[1] ?? name}`,
                relationship: 'أم',
                email: isParentsChild ? e.parent : null,
                phone: isParentsChild
                  ? null
                  : `+9665${String(10000000 + i * 7919 + name.length).slice(0, 8)}`,
                userId: isParentsChild ? parent.id : null,
                isPrimary: true,
              },
            });
            // Today's attendance for most children.
            if (i % 4 !== 3) {
              await db.childAttendance.create({
                data: {
                  daycareId,
                  childId: child.id,
                  date: dbDate(today),
                  status: i % 5 === 4 ? 'ABSENT' : 'ATTENDED',
                  checkInAt: i % 5 === 4 ? null : new Date(),
                  droppedOffBy: i % 5 === 4 ? null : 'الأم',
                  method: 'MANUAL',
                },
              });
            }
          }

          const unit = await db.unit.create({
            data: {
              daycareId,
              name: 'وحدة الماء',
              color: '#5b6db4',
              goals: ['التعرف على مصادر الماء', 'الحفاظ على الماء'],
              startDate: day(-7),
              isTest: true,
            },
          });
          const items: ['LESSON' | 'ACTIVITY', string][] = [
            ['LESSON', 'التعرف على الماء'],
            ['LESSON', 'مصادر الماء'],
            ['ACTIVITY', 'تجربة الطفو والغوص'],
            ['ACTIVITY', 'رسم البحر'],
          ];
          for (const [n, [kind, title]] of items.entries()) {
            await db.unitItem.create({
              data: { daycareId, unitId: unit.id, kind, title, sortOrder: n },
            });
          }
          const events = [
            {
              title: 'درس: مصادر الماء',
              type: 'LESSON',
              audience: 'CLASS',
              classroomId: classIds[0],
              unitId: unit.id,
              teacherId: teacherMembership,
              startDate: day(0),
              startTime: '08:30',
              endTime: '09:15',
            },
            {
              title: 'نشاط: تجربة الطفو',
              type: 'ACTIVITY',
              audience: 'CLASS',
              classroomId: classIds[0],
              unitId: unit.id,
              teacherId: teacherMembership,
              startDate: day(1),
              startTime: '10:00',
              endTime: '10:45',
            },
            {
              title: 'اجتماع أولياء الأمور',
              type: 'MEETING',
              audience: 'BRANCH',
              startDate: day(2),
              startTime: '16:00',
              endTime: '17:00',
            },
            { title: 'رحلة إلى الحديقة', type: 'TRIP', audience: 'BRANCH', startDate: day(4) },
          ] as const;
          for (const ev of events) {
            await db.calendarEvent.create({
              data: {
                daycareId,
                title: ev.title,
                type: ev.type,
                audience: ev.audience,
                classroomId: 'classroomId' in ev ? ev.classroomId : null,
                unitId: 'unitId' in ev ? ev.unitId : null,
                teacherId: 'teacherId' in ev ? ev.teacherId : null,
                startDate: ev.startDate,
                endDate: ev.startDate,
                startTime: 'startTime' in ev ? ev.startTime : null,
                endTime: 'endTime' in ev ? ev.endTime : null,
                createdById: manager.id,
              },
            });
          }
          await db.admissionRequest.create({
            data: {
              daycareId,
              requestedById: parent.id,
              childName: `رنا ${p.parent.split(' ')[1] ?? ''}`.trim(),
              childGender: 'FEMALE',
              childBirthDate: day(-700),
              guardianName: p.parent,
              relationship: 'أم',
              email: e.parent,
              notes: 'أخت أطفالنا في الفرع، نرغب بتسجيلها في الفصل القادم.',
            },
          });

          // Messages: parent ↔ teacher about the first child, staff chat, and an announcement.
          const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000);
          const childThread = await db.messageThread.create({
            data: {
              daycareId,
              kind: 'CHILD',
              childId: childIds[0],
              createdById: teacher.id,
              lastMessageAt: at(5),
            },
          });
          const msgs: [string, string, number][] = [
            [teacher.id, `صباح الخير، ${p.kids[0]![0].split(' ')[0]} وصلت بنشاط اليوم 🌸`, 90],
            [parent.id, 'صباح النور، شكرًا أستاذة. هل تناولت فطورها؟', 60],
            [teacher.id, 'نعم، تناولت الفطور كاملًا وشاركت في نشاط الرسم.', 5],
          ];
          for (const [senderId, body, ago] of msgs) {
            await db.message.create({
              data: { daycareId, threadId: childThread.id, senderId, body, createdAt: at(ago) },
            });
          }
          await db.threadRead.create({
            data: { threadId: childThread.id, userId: teacher.id, lastReadAt: at(5) },
          });
          await db.threadRead.create({
            data: { threadId: childThread.id, userId: parent.id, lastReadAt: at(60) },
          });
          const [userA, userB] = [manager.id, teacher.id].sort() as [string, string];
          const staffThread = await db.messageThread.create({
            data: {
              daycareId,
              kind: 'STAFF',
              userA,
              userB,
              createdById: manager.id,
              lastMessageAt: at(30),
            },
          });
          await db.message.create({
            data: {
              daycareId,
              threadId: staffThread.id,
              senderId: manager.id,
              body: 'أرجو تجهيز تقرير الحضور الأسبوعي قبل الخميس.',
              createdAt: at(30),
            },
          });
          const ann = await db.messageThread.create({
            data: {
              daycareId,
              kind: 'ANNOUNCEMENT',
              title: 'إعلان: رحلة الحديقة',
              createdById: manager.id,
              lastMessageAt: at(120),
            },
          });
          await db.message.create({
            data: {
              daycareId,
              threadId: ann.id,
              senderId: manager.id,
              body: 'سيكون لدينا رحلة إلى الحديقة يوم الخميس. يرجى إرسال قبعة وماء.',
              createdAt: at(120),
            },
          });
        }
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
    this.logger.log('Demo data created');
  }

  /**
   * Keeps the demo alive day after day (idempotent, runs on every start):
   * a fee plan + this month's subscriptions once, and today's attendance, staff
   * check-ins and shared daily reports when missing.
   */
  async refreshToday(): Promise<void> {
    const db = this.prisma.raw;
    const today = localDate();
    const date = dbDate(today);
    const monthStart = `${today.slice(0, 8)}01`;
    const monthEnd = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0))
      .toISOString()
      .slice(0, 10);
    const branches = await db.daycare.findMany({ where: { deletedAt: null } });
    for (const b of branches) {
      const kids = await db.child.findMany({
        where: { daycareId: b.id, isTest: true, deletedAt: null, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!kids.length) continue;
      const author = await db.membership.findFirst({
        where: { daycareId: b.id, isTest: true, role: 'STAFF', deletedAt: null },
      });
      // Plan + subscriptions (once).
      if (!(await db.plan.count({ where: { daycareId: b.id, isTest: true } }))) {
        const plan = await db.plan.create({
          data: {
            daycareId: b.id,
            name: 'الخطة الشهرية',
            price: 1800,
            period: 'MONTHLY',
            services: ['وجبات', 'أنشطة', 'تقارير يومية'],
            isTest: true,
          },
        });
        await db.plan.create({
          data: {
            daycareId: b.id,
            name: 'الفصل الدراسي',
            price: 6500,
            period: 'TERM',
            services: ['وجبات', 'أنشطة', 'مواصلات'],
            isTest: true,
          },
        });
        for (const [i, k] of kids.entries()) {
          const paid = i % 3 !== 1;
          await db.subscription.create({
            data: {
              daycareId: b.id,
              childId: k.id,
              planId: plan.id,
              value: 1800,
              startDate: dbDate(monthStart),
              endDate: dbDate(monthEnd),
              paymentStatus: paid ? 'PAID' : 'UNPAID',
              paymentMethod: paid ? (['CASH', 'CARD', 'TRANSFER'] as const)[i % 3] : null,
              paidAt: paid ? new Date() : null,
              isTest: true,
            },
          });
        }
      }
      // Today's attendance.
      for (const [i, k] of kids.entries()) {
        if (i % 4 === 3) continue;
        const status = i % 5 === 4 ? 'ABSENT' : i % 7 === 6 ? 'VACATION' : 'ATTENDED';
        await db.childAttendance.upsert({
          where: { childId_date: { childId: k.id, date } },
          update: {},
          create: {
            daycareId: b.id,
            childId: k.id,
            date,
            status,
            checkInAt:
              status === 'ATTENDED'
                ? new Date(`${today}T05:${String(10 + i).padStart(2, '0')}:00Z`)
                : null,
            droppedOffBy: status === 'ATTENDED' ? 'الأم' : null,
            method: i % 2 ? 'QR' : 'MANUAL',
          },
        });
      }
      // Staff check-ins.
      const staff = await db.membership.findMany({
        where: {
          daycareId: b.id,
          isTest: true,
          deletedAt: null,
          role: { in: ['MANAGER', 'STAFF'] },
        },
      });
      for (const m of staff) {
        const exists = await db.staffAttendance.findFirst({ where: { membershipId: m.id, date } });
        if (!exists) {
          await db.staffAttendance.create({
            data: {
              daycareId: b.id,
              membershipId: m.id,
              date,
              checkInAt: new Date(`${today}T04:45:00Z`),
              method: 'PIN',
            } as never,
          });
        }
      }
      // Shared daily reports for half of the class.
      for (const [i, k] of kids.entries()) {
        if (i % 2) continue;
        await db.dailyReport.upsert({
          where: { childId_date: { childId: k.id, date } },
          update: {},
          create: {
            daycareId: b.id,
            childId: k.id,
            date,
            meals: [
              { meal: 'BREAKFAST', amount: 'ALL' },
              { meal: 'LUNCH', amount: i % 4 ? 'MOST' : 'ALL' },
            ],
            napMinutes: 45 + (i % 3) * 15,
            toilet: 2,
            mood: (['HAPPY', 'CALM', 'TIRED'] as const)[i % 3],
            activities: 'رسم، قصة، لعب في الساحة',
            authorId: author?.userId ?? null,
            sharedAt: new Date(),
            isTest: true,
          },
        });
      }
    }
  }
}
