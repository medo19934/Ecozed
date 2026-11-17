import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

describe('Phase 4 — admissions, units, calendar (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  let branchId: string;
  let otherBranch: string;
  let admin: string;
  let teacher: string;
  let teacherMembership: string;
  let parent: string;
  let classA: string;
  let classB: string;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const signIn = async (email: string, sub: string): Promise<AuthResponse> =>
    (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(email, sub) })
        .expect(200)
    ).body;
  const switchTo = async (token: string, id: string) =>
    (
      await http
        .post('/api/v1/auth/switch-daycare')
        .set(bearer(token))
        .send({ daycareId: id })
        .expect(200)
    ).body.tokens.accessToken as string;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    branchId = (await prisma.raw.daycare.create({ data: { name: `منهج ${u}`, slug: `p4-${u}` } }))
      .id;
    otherBranch = (
      await prisma.raw.daycare.create({ data: { name: `آخر ${u}`, slug: `p4o-${u}` } })
    ).id;
    const boss = await signIn('boss@latif.test', 'g-boss');
    admin = await switchTo(boss.tokens.accessToken, branchId);
    classA = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'A', capacity: 10 })
        .expect(201)
    ).body.id;
    classB = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'B', capacity: 10 })
        .expect(201)
    ).body.id;
    teacherMembership = (
      await http
        .post('/api/v1/staff')
        .set(bearer(admin))
        .send({
          email: `cur-t${u}@example.com`,
          fullName: 'معلمة',
          classIds: [classA],
          permissions: [],
        })
        .expect(201)
    ).body.membershipId;
    teacher = (await signIn(`cur-t${u}@example.com`, `g-cur-t-${u}`)).tokens.accessToken;
    parent = (await signIn(`cur-p${u}@example.com`, `g-cur-p-${u}`)).tokens.accessToken;
  });
  afterAll(() => app.close());

  let admissionId: string;
  it('parent lists branches and requests admission ("Enroll my child")', async () => {
    const branches = await http.get('/api/v1/branches').set(bearer(parent)).expect(200);
    expect(branches.body.map((b: { id: string }) => b.id)).toContain(branchId);
    await http
      .post('/api/v1/admissions')
      .set(bearer(parent))
      .send({
        daycareId: branchId,
        childName: 'ريم',
        childGender: 'FEMALE',
        childBirthDate: '2022-04-01',
        guardianName: 'أم ريم',
        relationship: 'أم',
      })
      .expect(201)
      .then((r) => {
        admissionId = r.body.id;
        expect(r.body).toMatchObject({ status: 'UNDER_REVIEW', email: `cur-p${u}@example.com` });
      });
    const mine = await http.get('/api/v1/admissions/mine').set(bearer(parent)).expect(200);
    expect(mine.body[0].id).toBe(admissionId);
  });

  it('staff list with counts/search/status; teacher without permission is refused', async () => {
    await http.get('/api/v1/admissions').set(bearer(teacher)).expect(403);
    await http.get('/api/v1/admissions').set(bearer(parent)).expect(403);
    const r = await http.get('/api/v1/admissions?search=ريم').set(bearer(admin)).expect(200);
    expect(r.body.counts).toMatchObject({ total: 1, UNDER_REVIEW: 1 });
    expect(r.body.items[0].number).toBeGreaterThan(0);
    const other = await switchTo(admin, otherBranch);
    const none = await http.get('/api/v1/admissions').set(bearer(other)).expect(200);
    expect(none.body.items.find((a: { id: string }) => a.id === admissionId)).toBeUndefined();
  });

  it('accept creates the child in the class and links the parent', async () => {
    const r = await http
      .post(`/api/v1/admissions/${admissionId}/accept`)
      .set(bearer(admin))
      .send({ classroomId: classA })
      .expect(200);
    expect(r.body.status).toBe('ACCEPTED');
    await http
      .post(`/api/v1/admissions/${admissionId}/accept`)
      .set(bearer(admin))
      .send({})
      .expect(400);
    const parentAgain = await signIn(`cur-p${u}@example.com`, `g-cur-p-${u}`);
    expect(parentAgain.user.daycareId).toBe(branchId);
    const kids = await http
      .get('/api/v1/parent/children')
      .set(bearer(parentAgain.tokens.accessToken))
      .expect(200);
    expect(kids.body).toEqual([
      expect.objectContaining({ id: r.body.childId, classroom: { id: classA, name: 'A' } }),
    ]);
    parent = parentAgain.tokens.accessToken;
  });

  it('reject stores the reason', async () => {
    const a = await http
      .post('/api/v1/admissions')
      .set(bearer(parent))
      .send({
        daycareId: branchId,
        childName: 'سعد',
        childGender: 'MALE',
        childBirthDate: '2021-01-01',
        guardianName: 'أب',
        relationship: 'أب',
        phone: '+966511112222',
      })
      .expect(201);
    await http
      .post(`/api/v1/admissions/${a.body.id}/reject`)
      .set(bearer(admin))
      .send({ reason: 'لا توجد أماكن شاغرة حاليًا' })
      .expect(200);
    const mine = await http.get('/api/v1/admissions/mine').set(bearer(parent)).expect(200);
    expect(mine.body.find((x: { id: string }) => x.id === a.body.id)).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'لا توجد أماكن شاغرة حاليًا',
    });
  });

  let unitId: string;
  it('units: create, lessons & activities, archive; teachers read only', async () => {
    const r = await http
      .post('/api/v1/units')
      .set(bearer(admin))
      .send({ name: 'وحدة الماء', goals: ['التعرف على الماء'], minAgeMonths: 24, maxAgeMonths: 48 })
      .expect(201);
    unitId = r.body.id;
    await http
      .post(`/api/v1/units/${unitId}/items`)
      .set(bearer(admin))
      .send({ kind: 'LESSON', title: 'مصادر الماء' })
      .expect(201);
    const withItem = await http
      .post(`/api/v1/units/${unitId}/items`)
      .set(bearer(admin))
      .send({ kind: 'ACTIVITY', title: 'تجربة الطفو' })
      .expect(201);
    expect(withItem.body).toMatchObject({ lessons: 1, activities: 1 });
    await http.post('/api/v1/units').set(bearer(teacher)).send({ name: 'x unit' }).expect(403);
    const list = await http.get('/api/v1/units').set(bearer(teacher)).expect(200);
    expect(list.body.counts).toMatchObject({ active: 1 });
    expect(list.body.teachers.map((t: { membershipId: string }) => t.membershipId)).toContain(
      teacherMembership,
    );
    await http.post(`/api/v1/units/${unitId}/archive`).set(bearer(admin)).expect(201);
    const archived = await http.get('/api/v1/units?status=ARCHIVED').set(bearer(admin)).expect(200);
    expect(archived.body.items[0].id).toBe(unitId);
    await http.post(`/api/v1/units/${unitId}/restore`).set(bearer(admin)).expect(201);
  });

  it('calendar: audiences and visibility per role', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const ev = (body: object) =>
      http
        .post('/api/v1/calendar')
        .set(bearer(admin))
        .send({ startDate: today, endDate: today, ...body });
    await ev({ title: 'فعالية الفرع', audience: 'BRANCH', type: 'EVENT' }).expect(201);
    await ev({
      title: 'درس فصل أ',
      audience: 'CLASS',
      classroomId: classA,
      type: 'LESSON',
      unitId,
      teacherId: teacherMembership,
      startTime: '08:00',
      endTime: '09:00',
    }).expect(201);
    await ev({
      title: 'نشاط فصل ب',
      audience: 'CLASS',
      classroomId: classB,
      type: 'ACTIVITY',
    }).expect(201);
    await ev({ title: 'إجازة رسمية', audience: 'ALL', type: 'HOLIDAY' }).expect(201);
    await ev({ title: 'no class', audience: 'CLASS' }).expect(400);
    await ev({ title: 'bad time', startTime: '10:00', endTime: '09:00' }).expect(400);
    await http
      .post('/api/v1/calendar')
      .set(bearer(teacher))
      .send({ title: 'x title', startDate: today, endDate: today })
      .expect(403);

    const q = `/api/v1/calendar?from=${today}&to=${today}`;
    const titles = async (t: string) =>
      ((await http.get(q).set(bearer(t)).expect(200)).body as { title: string }[])
        .map((e) => e.title)
        .sort();
    expect(await titles(admin)).toEqual(
      expect.arrayContaining(['فعالية الفرع', 'درس فصل أ', 'نشاط فصل ب', 'إجازة رسمية']),
    );
    const forTeacher = await titles(teacher);
    expect(forTeacher).toEqual(
      expect.arrayContaining(['فعالية الفرع', 'درس فصل أ', 'إجازة رسمية']),
    );
    expect(forTeacher).not.toContain('نشاط فصل ب');
    const forParent = await titles(parent);
    expect(forParent).toEqual(expect.arrayContaining(['فعالية الفرع', 'درس فصل أ', 'إجازة رسمية']));
    expect(forParent).not.toContain('نشاط فصل ب');

    const lesson = (await http.get(q).set(bearer(admin))).body.find(
      (e: { title: string }) => e.title === 'درس فصل أ',
    );
    expect(lesson).toMatchObject({
      unit: { id: unitId },
      teacher: { membershipId: teacherMembership },
      canEdit: true,
    });
    await http.delete(`/api/v1/calendar/${lesson.id}`).set(bearer(admin)).expect(200);
    expect(await titles(parent)).not.toContain('درس فصل أ');
  });

  it('dashboard counts units and activities', async () => {
    const s = await http.get('/api/v1/dashboard/summary').set(bearer(admin)).expect(200);
    expect(s.body.units).toBe(1);
    expect(s.body.activities).toBeGreaterThanOrEqual(2);
  });
});
