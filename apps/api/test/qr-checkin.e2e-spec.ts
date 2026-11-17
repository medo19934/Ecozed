import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppConfig } from '../src/config/app-config.service';
import { kioskToken } from '../src/modules/attendance/attendance.util';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

/** Part B: the kiosk QR performs check-in/out (preview → choose → check_in), single use, PIN limits. */
describe('QR check-in (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let secret: string;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  let branch: string, admin: string, parent: string, teacher: string, kid1: string, kid2: string;
  const freshToken = async () =>
    (await http.get('/api/v1/attendance/kiosk/token').set(bearer(admin)).expect(200)).body
      .token as string;
  const attended = async () =>
    (await http.get('/api/v1/dashboard/attendance').set(bearer(admin)).expect(200)).body.counts
      .ATTENDED as number;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    secret = `${app.get(AppConfig).get('JWT_ACCESS_SECRET')}:attendance`;
    branch = (await prisma.raw.daycare.create({ data: { name: `QR ${u}`, slug: `qr-${u}` } })).id;
    await prisma.raw.daycareFeature.create({
      data: { daycareId: branch, key: 'childQrAttendance', enabled: true },
    });
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
        .send({ daycareId: branch })
        .expect(200)
    ).body.tokens.accessToken;
    const cls = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'A', capacity: 10 })
        .expect(201)
    ).body.id;
    const email = `qr-p${u}@example.com`;
    const child = async (name: string) =>
      (
        await http
          .post('/api/v1/children')
          .set(bearer(admin))
          .send({
            fullName: name,
            gender: 'FEMALE',
            birthDate: '2022-01-01',
            classroomId: cls,
            guardians: [{ fullName: 'أم', relationship: 'أم', email }],
          })
          .expect(201)
      ).body.id;
    kid1 = await child('سارة');
    kid2 = await child('نورة');
    parent = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(email, `g-qr-${u}`) })
        .expect(200)
    ).body.tokens.accessToken;
    await http
      .post('/api/v1/staff')
      .set(bearer(admin))
      .send({ email: `qr-t${u}@example.com`, fullName: 'معلمة', classIds: [cls] })
      .expect(201);
    teacher = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(`qr-t${u}@example.com`, `g-qrt-${u}`) })
        .expect(200)
    ).body.tokens.accessToken;
  });
  afterAll(() => app.close());

  it('parent: preview lists children, check-in of the chosen child writes a row and updates the donut', async () => {
    const before = await attended();
    const rowsBefore = await prisma.raw.childAttendance.count({
      where: { childId: { in: [kid1, kid2] } },
    });
    const token = await freshToken();
    const p = (
      await http
        .post('/api/v1/attendance/kiosk/preview')
        .set(bearer(parent))
        .send({ token })
        .expect(200)
    ).body;
    expect(p).toMatchObject({ kind: 'PARENT' });
    expect(p.children.map((c: { id: string; next: string }) => [c.id, c.next]).sort()).toEqual(
      [
        [kid1, 'IN'],
        [kid2, 'IN'],
      ].sort(),
    );
    expect(p.expiresInSeconds).toBeGreaterThan(0);
    // Preview writes nothing.
    expect(
      await prisma.raw.childAttendance.count({ where: { childId: { in: [kid1, kid2] } } }),
    ).toBe(rowsBefore);

    const r = (
      await http
        .post('/api/v1/attendance/kiosk/scan')
        .set(bearer(parent))
        .send({ token, childIds: [kid1], direction: 'IN' })
        .expect(200)
    ).body;
    expect(r.items).toEqual([
      expect.objectContaining({ kind: 'CHILD', name: 'سارة', direction: 'IN' }),
    ]);
    expect(
      await prisma.raw.childAttendance.count({ where: { childId: kid1, status: 'ATTENDED' } }),
    ).toBe(1);
    expect(await prisma.raw.childAttendance.count({ where: { childId: kid2 } })).toBe(0);
    expect(await attended()).toBe(before + 1);
  });

  it('a used token is rejected for the same person; an old or forged token is rejected', async () => {
    const token = await freshToken();
    await http
      .post('/api/v1/attendance/kiosk/scan')
      .set(bearer(parent))
      .send({ token, childIds: [kid2], direction: 'IN' })
      .expect(200);
    const again = await http
      .post('/api/v1/attendance/kiosk/scan')
      .set(bearer(parent))
      .send({ token, childIds: [kid2], direction: 'OUT' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('qr_used');
    await http
      .post('/api/v1/attendance/kiosk/preview')
      .set(bearer(parent))
      .send({ token })
      .expect(409);

    const old = kioskToken(secret, branch, Date.now() - 10 * 60_000).token;
    const r = await http
      .post('/api/v1/attendance/kiosk/scan')
      .set(bearer(parent))
      .send({ token: old, childIds: [kid2] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('invalid_qr');
    const forged = kioskToken('wrong-secret', branch).token;
    expect(
      (await http.post('/api/v1/attendance/kiosk/scan').set(bearer(parent)).send({ token: forged }))
        .body.code,
    ).toBe('invalid_qr');
  });

  it('checking in a child who is already in is refused (explicit direction)', async () => {
    const token = await freshToken();
    const r = await http
      .post('/api/v1/attendance/kiosk/scan')
      .set(bearer(parent))
      .send({ token, childIds: [kid1], direction: 'IN' });
    expect([400, 409]).toContain(r.status);
  });

  it('teacher records her own attendance', async () => {
    const token = await freshToken();
    const p = (
      await http
        .post('/api/v1/attendance/kiosk/preview')
        .set(bearer(teacher))
        .send({ token })
        .expect(200)
    ).body;
    expect(p).toMatchObject({ kind: 'STAFF', staffNext: 'IN' });
    const r = (
      await http
        .post('/api/v1/attendance/kiosk/scan')
        .set(bearer(teacher))
        .send({ token, direction: 'IN' })
        .expect(200)
    ).body;
    expect(r.items[0]).toMatchObject({ kind: 'STAFF', direction: 'IN' });
    expect(await prisma.raw.staffAttendance.count({ where: { daycareId: branch } })).toBe(1);
  });

  it('PIN: 5 wrong attempts lock the kiosk', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await http
        .post('/api/v1/attendance/kiosk/pin')
        .set(bearer(admin))
        .send({ pin: '000000' });
      expect(r.status).toBe(400);
    }
    const locked = await http
      .post('/api/v1/attendance/kiosk/pin')
      .set(bearer(admin))
      .send({ pin: '000001' });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('pin_locked');
  });
});
