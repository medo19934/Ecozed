import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.PUBLIC_DEMO = 'false';

/** Sample (TEST) data: per-branch removal and the general admin's "all branches" button. */
describe('TEST data removal (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  let a: string, b: string, adminA: string, adminB: string, managerA: string, realClass: string;

  beforeAll(async () => {
    const f = await import('./app.factory');
    app = await f.createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    a = (await prisma.raw.daycare.create({ data: { name: `تجربة أ ${u}`, slug: `td-a-${u}` } })).id;
    b = (await prisma.raw.daycare.create({ data: { name: `تجربة ب ${u}`, slug: `td-b-${u}` } })).id;
    const boss = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: f.googleToken('boss@latif.test', 'g-boss') })
        .expect(200)
    ).body as AuthResponse;
    const sw = async (d: string) =>
      (
        await http
          .post('/api/v1/auth/switch-daycare')
          .set(bearer(boss.tokens.accessToken))
          .send({ daycareId: d })
          .expect(200)
      ).body.tokens.accessToken as string;
    adminA = await sw(a);
    adminB = await sw(b);
    realClass = (
      await http
        .post('/api/v1/classes')
        .set(bearer(adminA))
        .send({ name: 'Duck Class', capacity: 20 })
        .expect(201)
    ).body.id;
    const m = (
      await http
        .post('/api/v1/users')
        .set(bearer(adminA))
        .send({ role: 'MANAGER', fullName: 'مديرة', email: `td-m${u}@example.com` })
        .expect(201)
    ).body;
    managerA = (
      await http
        .post('/api/v1/auth/login')
        .send({ identifier: `td-m${u}@example.com`, password: m.issued.tempPassword })
        .expect(200)
    ).body.tokens.accessToken;
  });
  afterAll(() => app.close());

  it('removes sample data from every branch in one click, keeping real data', async () => {
    await http.post('/api/v1/test-data').set(bearer(adminA)).expect(201);
    await http.post('/api/v1/test-data').set(bearer(adminB)).expect(201);
    expect(
      await prisma.raw.child.count({ where: { daycareId: { in: [a, b] }, isTest: true } }),
    ).toBeGreaterThan(0);
    // Branch managers cannot clear other branches.
    await http.delete('/api/v1/test-data/all').set(bearer(managerA)).expect(403);
    const r = await http.delete('/api/v1/test-data/all').set(bearer(adminA)).expect(200);
    expect(r.body.branches).toBeGreaterThanOrEqual(2);
    for (const d of [a, b]) {
      expect(await prisma.raw.child.count({ where: { daycareId: d, isTest: true } })).toBe(0);
      expect(await prisma.raw.membership.count({ where: { daycareId: d, isTest: true } })).toBe(0);
      expect(await prisma.raw.classroom.count({ where: { daycareId: d, isTest: true } })).toBe(0);
    }
    // Real class and the real manager stay.
    expect(await prisma.raw.classroom.count({ where: { id: realClass, deletedAt: null } })).toBe(1);
    expect(await prisma.raw.membership.count({ where: { daycareId: a, role: 'MANAGER' } })).toBe(1);
  });
});
