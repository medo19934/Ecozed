import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

describe('Subscriptions, daily reports, admins, reports (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: string;
  let parent: string;
  let teacher: string;
  let kid: string;
  let classId: string;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    const prisma = app.get(PrismaService);
    const branchId = (
      await prisma.raw.daycare.create({ data: { name: `مالية ${u}`, slug: `fin-${u}` } })
    ).id;
    const boss = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken('boss@latif.test', 'g-boss') })
        .expect(200)
    ).body;
    admin = (
      await http
        .post('/api/v1/auth/switch-daycare')
        .set(bearer(boss.tokens.accessToken))
        .send({ daycareId: branchId })
        .expect(200)
    ).body.tokens.accessToken;
    classId = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'A', capacity: 10 })
        .expect(201)
    ).body.id;
    const email = `fin-p${u}@example.com`;
    kid = (
      await http
        .post('/api/v1/children')
        .set(bearer(admin))
        .send({
          fullName: 'سعد',
          gender: 'MALE',
          birthDate: '2022-01-01',
          classroomId: classId,
          guardians: [{ fullName: 'أم سعد', relationship: 'أم', email }],
        })
        .expect(201)
    ).body.id;
    parent = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(email, `g-${u}`) })
        .expect(200)
    ).body.tokens.accessToken;
    await http
      .post('/api/v1/staff')
      .set(bearer(admin))
      .send({ email: `fin-t${u}@example.com`, fullName: 'معلمة', classIds: [classId] })
      .expect(201);
    teacher = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(`fin-t${u}@example.com`, `g-t${u}`) })
        .expect(200)
    ).body.tokens.accessToken;
  });
  afterAll(() => app.close());

  it('plans + subscriptions: create, filter, remind (message to family), mark paid, cancel', async () => {
    const plan = (
      await http
        .post('/api/v1/subscriptions/plans')
        .set(bearer(admin))
        .send({ name: 'شهري', price: 1500, period: 'MONTHLY', services: ['وجبات'] })
        .expect(201)
    ).body;
    const s = (
      await http
        .post('/api/v1/subscriptions')
        .set(bearer(admin))
        .send({
          childId: kid,
          planId: plan.id,
          value: 1500,
          startDate: '2026-11-01',
          endDate: '2026-11-30',
        })
        .expect(201)
    ).body;
    expect(s).toMatchObject({ paymentStatus: 'UNPAID', status: 'ACTIVE', value: 1500 });
    const list = (
      await http.get('/api/v1/subscriptions?paymentStatus=UNPAID').set(bearer(admin)).expect(200)
    ).body;
    expect(list.summary).toMatchObject({ total: 1, unpaid: 1, unpaidAmount: 1500 });
    await http.post(`/api/v1/subscriptions/${s.id}/remind`).set(bearer(admin)).expect(200);
    const threads = (await http.get('/api/v1/messages/threads').set(bearer(parent)).expect(200))
      .body;
    expect(threads[0].lastMessage.body).toContain('تذكير بسداد');
    const mine = (await http.get('/api/v1/subscriptions/mine').set(bearer(parent)).expect(200))
      .body;
    expect(mine[0]).toMatchObject({ id: s.id, reminders: 1 });
    await http.get('/api/v1/subscriptions').set(bearer(parent)).expect(403);
    await http.get('/api/v1/subscriptions').set(bearer(teacher)).expect(403);
    const paid = (
      await http
        .post(`/api/v1/subscriptions/${s.id}/paid`)
        .set(bearer(admin))
        .send({ paymentMethod: 'CARD' })
        .expect(200)
    ).body;
    expect(paid).toMatchObject({ paymentStatus: 'PAID', paymentMethod: 'CARD' });
    await http.post(`/api/v1/subscriptions/${s.id}/cancel`).set(bearer(admin)).expect(200);
    expect(
      (await http.get('/api/v1/subscriptions').set(bearer(admin)).expect(200)).body.summary
        .canceled,
    ).toBe(1);
  });

  it('daily report: teacher writes + shares, parent reads, chat gets it', async () => {
    const day = (
      await http.get('/api/v1/daily-reports?date=2026-11-17').set(bearer(teacher)).expect(200)
    ).body;
    expect(day.map((r: { child: { id: string } }) => r.child.id)).toEqual([kid]);
    await http
      .put('/api/v1/daily-reports')
      .set(bearer(teacher))
      .send({
        childId: kid,
        date: '2026-11-17',
        meals: [{ meal: 'LUNCH', amount: 'ALL' }],
        napMinutes: 60,
        mood: 'HAPPY',
        activities: 'رسم',
        share: true,
      })
      .expect(200);
    const mine = (await http.get('/api/v1/daily-reports/mine').set(bearer(parent)).expect(200))
      .body;
    expect(mine[0]).toMatchObject({ napMinutes: 60, mood: 'HAPPY' });
    const threads = (await http.get('/api/v1/messages/threads').set(bearer(parent)).expect(200))
      .body;
    expect(threads[0].lastMessage.body).toContain('التقرير اليومي');
    await http
      .put('/api/v1/daily-reports')
      .set(bearer(parent))
      .send({ childId: kid, date: '2026-11-17' })
      .expect(403);
  });

  it('reports + admins', async () => {
    const r = (
      await http.get('/api/v1/reports?from=2026-11-01&to=2026-11-30').set(bearer(admin)).expect(200)
    ).body;
    expect(r.occupancy[0]).toMatchObject({ name: 'A', capacity: 10, children: 1 });
    await http.get('/api/v1/reports').set(bearer(teacher)).expect(403);
    const add = (
      await http
        .post('/api/v1/admins')
        .set(bearer(admin))
        .send({ identifier: `owner${u}@example.com`, fullName: 'المالك' })
        .expect(201)
    ).body;
    expect(add.issued.tempPassword).toHaveLength(10);
    const list = (await http.get('/api/v1/admins').set(bearer(admin)).expect(200)).body;
    expect(list.some((x: { email: string }) => x.email === `owner${u}@example.com`)).toBe(true);
    await http.get('/api/v1/admins').set(bearer(teacher)).expect(403);
  });
});
