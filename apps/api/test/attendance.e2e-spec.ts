import { localDate } from '@latif/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

describe('Phase 3 — dashboard & attendance (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  let branchId: string;
  let admin: string;
  let teacher: string;
  let teacherMembership: string;
  let mom: string;
  let classA: string;
  let kid1: string;
  let kid2: string;
  let other: string;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const signIn = async (email: string, sub: string): Promise<AuthResponse> =>
    (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(email, sub) })
        .expect(200)
    ).body;
  const waitDebounce = () =>
    prisma.raw.attendanceEvent.updateMany({
      where: { daycareId: branchId },
      data: { at: new Date(Date.now() - 120_000) },
    });

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    const b = await prisma.raw.daycare.create({
      data: {
        name: `حضور ${u}`,
        slug: `p3-${u}`,
        latitude: 24.7136,
        longitude: 46.6753,
        geofenceRadiusM: 100,
      },
    });
    branchId = b.id;
    await prisma.raw.daycareFeature.createMany({
      data: [
        { daycareId: b.id, key: 'childQrAttendance', enabled: true },
        { daycareId: b.id, key: 'staffGeofencedAttendance', enabled: true },
      ],
    });
    const boss = await signIn('boss@latif.test', 'g-boss');
    admin = (
      await http
        .post('/api/v1/auth/switch-daycare')
        .set(bearer(boss.tokens.accessToken))
        .send({ daycareId: branchId })
        .expect(200)
    ).body.tokens.accessToken;
    classA = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'A', capacity: 10 })
        .expect(201)
    ).body.id;
    const classB = (
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
          email: `att-t${u}@example.com`,
          fullName: 'معلمة الحضور',
          classIds: [classA],
          permissions: ['canManageAttendance'],
        })
        .expect(201)
    ).body.membershipId;
    teacher = (await signIn(`att-t${u}@example.com`, `g-att-t-${u}`)).tokens.accessToken;
    const child = (name: string, classroomId: string, email: string) =>
      http
        .post('/api/v1/children')
        .set(bearer(admin))
        .send({
          fullName: name,
          gender: 'FEMALE',
          birthDate: '2022-02-02',
          classroomId,
          guardians: [{ fullName: 'أم', relationship: 'أم', email }],
        })
        .expect(201)
        .then((r) => r.body.id as string);
    kid1 = await child('طفلة 1', classA, `att-mom${u}@example.com`);
    kid2 = await child('طفلة 2', classA, `att-mom${u}@example.com`);
    other = await child('طفلة ب', classB, `att-other${u}@example.com`);
    mom = (await signIn(`att-mom${u}@example.com`, `g-att-mom-${u}`)).tokens.accessToken;
  });
  afterAll(() => app.close());

  it('roster starts with no record; teacher sees own class only', async () => {
    const r = await http.get('/api/v1/attendance/children').set(bearer(admin)).expect(200);
    expect(r.body.counts.NO_RECORD).toBe(3);
    const t = await http.get('/api/v1/attendance/children').set(bearer(teacher)).expect(200);
    expect(t.body.rows.map((x: { child: { id: string } }) => x.child.id).sort()).toEqual(
      [kid1, kid2].sort(),
    );
  });

  it('manual check-in / check-out / absent / clear', async () => {
    const inn = await http
      .post(`/api/v1/attendance/children/${kid1}`)
      .set(bearer(teacher))
      .send({ action: 'CHECK_IN', person: 'الأم' })
      .expect(200);
    expect(inn.body).toMatchObject({ status: 'ATTENDED', droppedOffBy: 'الأم' });
    const out = await http
      .post(`/api/v1/attendance/children/${kid1}`)
      .set(bearer(teacher))
      .send({ action: 'CHECK_OUT', person: 'الأب' })
      .expect(200);
    expect(out.body).toMatchObject({ status: 'DEPARTURE', pickedUpBy: 'الأب' });
    await http
      .post(`/api/v1/attendance/children/${kid2}`)
      .set(bearer(teacher))
      .send({ action: 'CHECK_OUT' })
      .expect(400);
    await http
      .post(`/api/v1/attendance/children/${other}`)
      .set(bearer(teacher))
      .send({ action: 'ABSENT' })
      .expect(404);
    await http
      .post(`/api/v1/attendance/children/${other}`)
      .set(bearer(admin))
      .send({ action: 'ABSENT' })
      .expect(200);
    await http
      .post(`/api/v1/attendance/children/${kid1}`)
      .set(bearer(admin))
      .send({ action: 'CLEAR' })
      .expect(200);
    await http
      .post(`/api/v1/attendance/children/${kid1}`)
      .set(bearer(admin))
      .send({ action: 'ABSENT', date: '2999-01-01' })
      .expect(400);
  });

  it('kiosk QR: parent scans to drop off then pick up their children', async () => {
    await http.get('/api/v1/attendance/kiosk/token').set(bearer(mom)).expect(403);
    const { token, refreshInSeconds } = (
      await http.get('/api/v1/attendance/kiosk/token').set(bearer(admin)).expect(200)
    ).body;
    expect(refreshInSeconds).toBeLessThanOrEqual(30);
    const drop = await http
      .post('/api/v1/attendance/kiosk/scan')
      .set(bearer(mom))
      .send({ token })
      .expect(200);
    expect(drop.body.items.map((i: { direction: string }) => i.direction)).toEqual(['IN', 'IN']);
    await http.post('/api/v1/attendance/kiosk/scan').set(bearer(mom)).send({ token }).expect(409); // debounce
    await waitDebounce();
    const pick = await http
      .post('/api/v1/attendance/kiosk/scan')
      .set(bearer(mom))
      .send({ token, childIds: [kid2] })
      .expect(200);
    expect(pick.body.items).toEqual([
      expect.objectContaining({ direction: 'OUT', name: 'طفلة 2' }),
    ]);
    await http
      .post('/api/v1/attendance/kiosk/scan')
      .set(bearer(mom))
      .send({ token: `${token}x` })
      .expect(400);

    const me = await http.get('/api/v1/attendance/me').set(bearer(mom)).expect(200);
    const st = Object.fromEntries(
      me.body.children.map((c: { id: string; status: string }) => [c.id, c.status]),
    );
    expect(st).toEqual({ [kid1]: 'ATTENDED', [kid2]: 'DEPARTURE' });
  });

  it('personal PIN at the kiosk records staff check-in and check-out', async () => {
    const { pin } = (await http.post('/api/v1/attendance/me/pin').set(bearer(teacher)).expect(201))
      .body;
    expect(pin).toMatch(/^\d{6}$/);
    await http
      .post('/api/v1/attendance/kiosk/pin')
      .set(bearer(admin))
      .send({ pin: pin === '000000' ? '111111' : '000000' })
      .expect(400);
    const r = await http
      .post('/api/v1/attendance/kiosk/pin')
      .set(bearer(admin))
      .send({ pin })
      .expect(200);
    expect(r.body.items[0]).toMatchObject({ kind: 'STAFF', direction: 'IN' });
    await waitDebounce();
    const r2 = await http
      .post('/api/v1/attendance/kiosk/pin')
      .set(bearer(admin))
      .send({ pin })
      .expect(200);
    expect(r2.body.items[0].direction).toBe('OUT');
    const staff = await http.get('/api/v1/attendance/staff').set(bearer(admin)).expect(200);
    const row = staff.body.rows.find(
      (s: { membershipId: string }) => s.membershipId === teacherMembership,
    );
    expect(row.checkInAt && row.checkOutAt).toBeTruthy();
    expect(row.method).toBe('PIN');
  });

  it('geofenced staff check-in accepts inside the radius and rejects outside', async () => {
    await prisma.raw.staffAttendance.deleteMany({ where: { membershipId: teacherMembership } });
    await waitDebounce();
    const far = await http
      .post('/api/v1/attendance/geo')
      .set(bearer(teacher))
      .send({ latitude: 24.73, longitude: 46.6753 })
      .expect(400);
    expect(far.body.code).toBe('outside_geofence');
    const near = await http
      .post('/api/v1/attendance/geo')
      .set(bearer(teacher))
      .send({ latitude: 24.7139, longitude: 46.6753, accuracy: 10 })
      .expect(200);
    expect(near.body.items[0].direction).toBe('IN');
    await http
      .post('/api/v1/attendance/geo')
      .set(bearer(mom))
      .send({ latitude: 24.7136, longitude: 46.6753 })
      .expect(403);
  });

  it('parents request vacations; staff approve; roster shows VACATION', async () => {
    // Branch-local tomorrow (Asia/Riyadh), not UTC: after 21:00 UTC they differ.
    const t = new Date(`${localDate()}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 1);
    const tomorrow = t.toISOString().slice(0, 10);
    await http
      .post('/api/v1/attendance/vacations')
      .set(bearer(mom))
      .send({ childId: other, startDate: tomorrow, endDate: tomorrow })
      .expect(404);
    const v = await http
      .post('/api/v1/attendance/vacations')
      .set(bearer(mom))
      .send({ childId: kid1, startDate: tomorrow, endDate: tomorrow, reason: 'سفر' })
      .expect(201);
    const list = await http
      .get('/api/v1/attendance/vacations?status=PENDING')
      .set(bearer(teacher))
      .expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toContain(v.body.id);
    await http
      .post(`/api/v1/attendance/vacations/${v.body.id}/review`)
      .set(bearer(teacher))
      .send({ decision: 'APPROVED' })
      .expect(200);
    const roster = await http
      .get(`/api/v1/attendance/children?date=${tomorrow}`)
      .set(bearer(admin))
      .expect(200);
    expect(
      roster.body.rows.find((r: { child: { id: string } }) => r.child.id === kid1).status,
    ).toBe('VACATION');
    const mine = await http.get('/api/v1/attendance/vacations/mine').set(bearer(mom)).expect(200);
    expect(mine.body[0].status).toBe('APPROVED');
  });

  it('dashboard: real counts and attendance donut; all-branches for super admin only', async () => {
    const s = await http.get('/api/v1/dashboard/summary').set(bearer(admin)).expect(200);
    expect(s.body).toMatchObject({ children: 3, staff: 1, classes: 2 });
    const a = await http.get('/api/v1/dashboard/attendance').set(bearer(admin)).expect(200);
    expect(a.body.total).toBe(3);
    expect(a.body.counts).toMatchObject({ ATTENDED: 1, DEPARTURE: 1, ABSENT: 1 });
    const byClass = await http
      .get(`/api/v1/dashboard/attendance?classroomId=${classA}`)
      .set(bearer(admin))
      .expect(200);
    expect(byClass.body.total).toBe(2);
    const all = await http
      .get('/api/v1/dashboard/summary?scope=all')
      .set(bearer(admin))
      .expect(200);
    expect(all.body.children).toBeGreaterThanOrEqual(3);
    await http.get('/api/v1/dashboard/summary?scope=all').set(bearer(teacher)).expect(403);
    const t = await http.get('/api/v1/dashboard/summary').set(bearer(teacher)).expect(200);
    expect(t.body.children).toBe(2);
  });
});
