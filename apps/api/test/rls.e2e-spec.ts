import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

/**
 * Role-based access, proven as 4 real users (general admin, branch manager, teacher, parent):
 * 1) straight against the database as the restricted role (Row Level Security), and
 * 2) through API routes they must not use — while their own data still loads.
 */
describe('Row Level Security + role routes (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const google = async (email: string): Promise<AuthResponse> =>
    (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(email, `g-${email}`) })
        .expect(200)
    ).body;

  let branchA: string, branchB: string;
  let admin: AuthResponse, manager: AuthResponse, teacher: AuthResponse, parent: AuthResponse;
  let adminA: string, adminB: string;
  let kidA1: string, kidA2: string, kidB1: string;

  /** Runs SQL exactly as the API's per-request client does: role latif_rls + verified user id. */
  const asUser = async (userId: string | null, sql: string): Promise<{ id: string }[]> => {
    const [, rows] = await prisma.raw.$transaction([
      prisma.raw
        .$executeRaw`SELECT set_config('role', 'latif_rls', true), set_config('app.user_id', ${userId ?? ''}, true)`,
      prisma.raw.$queryRawUnsafe<{ id: string }[]>(sql),
    ]);
    return rows;
  };
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
  const kidsOf = (rows: { id: string }[]) =>
    ids(rows).filter((id) => [kidA1, kidA2, kidB1].includes(id));

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    branchA = (await prisma.raw.daycare.create({ data: { name: `أ ${u}`, slug: `rls-a-${u}` } }))
      .id;
    branchB = (await prisma.raw.daycare.create({ data: { name: `ب ${u}`, slug: `rls-b-${u}` } }))
      .id;
    admin = await google('boss@latif.test');
    const sw = async (d: string) =>
      (
        await http
          .post('/api/v1/auth/switch-daycare')
          .set(bearer(admin.tokens.accessToken))
          .send({ daycareId: d })
          .expect(200)
      ).body.tokens.accessToken;
    adminA = await sw(branchA);
    adminB = await sw(branchB);
    const classA1 = (
      await http
        .post('/api/v1/classes')
        .set(bearer(adminA))
        .send({ name: 'A1', capacity: 10 })
        .expect(201)
    ).body.id;
    const classA2 = (
      await http
        .post('/api/v1/classes')
        .set(bearer(adminA))
        .send({ name: 'A2', capacity: 10 })
        .expect(201)
    ).body.id;
    const classB1 = (
      await http
        .post('/api/v1/classes')
        .set(bearer(adminB))
        .send({ name: 'B1', capacity: 10 })
        .expect(201)
    ).body.id;
    await http
      .post('/api/v1/staff')
      .set(bearer(adminA))
      .send({ email: `rls-m${u}@example.com`, fullName: 'مديرة', role: 'MANAGER' })
      .expect(201);
    await http
      .post('/api/v1/staff')
      .set(bearer(adminA))
      .send({ email: `rls-t${u}@example.com`, fullName: 'معلمة', classIds: [classA1] })
      .expect(201);
    const child = async (token: string, name: string, classroomId: string, email: string) =>
      (
        await http
          .post('/api/v1/children')
          .set(bearer(token))
          .send({
            fullName: name,
            gender: 'MALE',
            birthDate: '2022-01-01',
            classroomId,
            guardians: [{ fullName: 'ولي', relationship: 'أم', email }],
          })
          .expect(201)
      ).body.id;
    kidA1 = await child(adminA, 'طفل أ1', classA1, `rls-p${u}@example.com`);
    kidA2 = await child(adminA, 'طفل أ2', classA2, `rls-other${u}@example.com`);
    kidB1 = await child(adminB, 'طفل ب1', classB1, `rls-otherb${u}@example.com`);
    // Some per-child data in every branch/class.
    for (const [tok, kid] of [
      [adminA, kidA1],
      [adminA, kidA2],
      [adminB, kidB1],
    ] as const) {
      await http
        .post(`/api/v1/attendance/children/${kid}`)
        .set(bearer(tok))
        .send({ action: 'CHECK_IN' })
        .expect(200);
      await http
        .post('/api/v1/subscriptions')
        .set(bearer(tok))
        .send({ childId: kid, value: 100, startDate: '2026-11-01', endDate: '2026-11-30' })
        .expect(201);
    }
    manager = await google(`rls-m${u}@example.com`);
    teacher = await google(`rls-t${u}@example.com`);
    parent = await google(`rls-p${u}@example.com`);
  });
  afterAll(() => app.close());

  describe('database (restricted role, deny by default)', () => {
    it('no user → no rows at all', async () => {
      expect(await asUser(null, 'SELECT id FROM "Child"')).toHaveLength(0);
      expect(await asUser(null, 'SELECT id FROM "Subscription"')).toHaveLength(0);
      expect(await asUser(null, 'SELECT id FROM "Membership"')).toHaveLength(0);
    });

    it('parent: only their own child (no other family, class or branch)', async () => {
      const uid = parent.user.id;
      expect(kidsOf(await asUser(uid, 'SELECT id FROM "Child"'))).toEqual([kidA1]);
      const att = await asUser(
        uid,
        `SELECT "childId" AS id FROM "ChildAttendance" WHERE "childId" IN ('${kidA1}','${kidA2}','${kidB1}')`,
      );
      expect(ids(att)).toEqual([kidA1]);
      const subs = await asUser(
        uid,
        `SELECT "childId" AS id FROM "Subscription" WHERE "childId" IN ('${kidA1}','${kidA2}','${kidB1}')`,
      );
      expect(ids(subs)).toEqual([kidA1]);
      // No staff list, no other families' memberships, no plans, no admissions table.
      const mem = await asUser(uid, `SELECT "userId" AS id FROM "Membership"`);
      expect(new Set(mem.map((m) => m.id))).toEqual(new Set([uid]));
      expect(
        await asUser(
          uid,
          `SELECT id FROM "AdmissionRequest" WHERE "daycareId" IN ('${branchA}','${branchB}')`,
        ),
      ).toHaveLength(0);
      expect(
        await asUser(uid, `SELECT id FROM "AuditLog" WHERE "daycareId" = '${branchA}'`),
      ).toHaveLength(0);
    });

    it('teacher: only children of her own class', async () => {
      const uid = teacher.user.id;
      expect(kidsOf(await asUser(uid, 'SELECT id FROM "Child"'))).toEqual([kidA1]);
      const att = await asUser(
        uid,
        `SELECT "childId" AS id FROM "ChildAttendance" WHERE "childId" IN ('${kidA1}','${kidA2}','${kidB1}')`,
      );
      expect(ids(att)).toEqual([kidA1]);
      expect(
        await asUser(
          uid,
          `SELECT id FROM "Subscription" WHERE "daycareId" IN ('${branchA}','${branchB}')`,
        ),
      ).toHaveLength(0);
      expect(
        await asUser(uid, `SELECT id FROM "Classroom" WHERE "daycareId" = '${branchB}'`),
      ).toHaveLength(0);
    });

    it('branch manager: whole own branch, nothing from another branch', async () => {
      const uid = manager.user.id;
      expect(kidsOf(await asUser(uid, 'SELECT id FROM "Child"'))).toEqual([kidA1, kidA2].sort());
      const subs = await asUser(
        uid,
        `SELECT "childId" AS id FROM "Subscription" WHERE "childId" IN ('${kidA1}','${kidA2}','${kidB1}')`,
      );
      expect(ids(subs)).toEqual([kidA1, kidA2].sort());
      expect(
        await asUser(uid, `SELECT id FROM "Classroom" WHERE "daycareId" = '${branchB}'`),
      ).toHaveLength(0);
      expect(
        await asUser(uid, `SELECT id FROM "Membership" WHERE "daycareId" = '${branchB}'`),
      ).toHaveLength(0);
    });

    it('general admin: everything', async () => {
      expect(kidsOf(await asUser(admin.user.id, 'SELECT id FROM "Child"'))).toEqual(
        [kidA1, kidA2, kidB1].sort(),
      );
    });

    it('cannot write into another branch (WITH CHECK)', async () => {
      await expect(
        asUser(
          manager.user.id,
          `INSERT INTO "Classroom" (id, "daycareId", name, capacity, "updatedAt") VALUES (gen_random_uuid(), '${branchB}', 'hack', 1, now()) RETURNING id`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  describe('API routes', () => {
    it('parent: forbidden admin routes, own data loads', async () => {
      const t = parent.tokens.accessToken;
      for (const path of [
        '/children',
        '/staff',
        '/subscriptions',
        '/admissions',
        '/reports',
        '/parents',
        '/dashboard/extras',
        '/test-data',
      ]) {
        const r = await http.get(`/api/v1${path}`).set(bearer(t));
        expect([403, 404]).toContain(r.status);
      }
      const mine = (await http.get('/api/v1/parent/children').set(bearer(t)).expect(200)).body;
      expect(mine.map((c: { id: string }) => c.id)).toEqual([kidA1]);
      const subs = (await http.get('/api/v1/subscriptions/mine').set(bearer(t)).expect(200)).body;
      expect(subs.map((s: { child: { id: string } }) => s.child.id)).toEqual([kidA1]);
    });

    it('teacher: other class 404, office routes 403, own class loads', async () => {
      const t = teacher.tokens.accessToken;
      await http.get(`/api/v1/children/${kidA2}`).set(bearer(t)).expect(404);
      await http.get(`/api/v1/children/${kidB1}`).set(bearer(t)).expect(404);
      for (const path of ['/subscriptions', '/admissions', '/reports', '/staff']) {
        expect([403, 404]).toContain((await http.get(`/api/v1${path}`).set(bearer(t))).status);
      }
      const list = (await http.get('/api/v1/children').set(bearer(t)).expect(200)).body;
      expect(list.items.map((c: { id: string }) => c.id)).toEqual([kidA1]);
    });

    it('manager: other branch invisible, cannot switch into it, own branch loads', async () => {
      const t = manager.tokens.accessToken;
      await http.get(`/api/v1/children/${kidB1}`).set(bearer(t)).expect(404);
      expect([401, 403, 404]).toContain(
        (await http.post('/api/v1/auth/switch-daycare').set(bearer(t)).send({ daycareId: branchB }))
          .status,
      );
      const list = (await http.get('/api/v1/children').set(bearer(t)).expect(200)).body;
      expect(list.items.map((c: { id: string }) => c.id).sort()).toEqual([kidA1, kidA2].sort());
      const subs = (await http.get('/api/v1/subscriptions').set(bearer(t)).expect(200)).body;
      expect(subs.items.map((s: { child: { id: string } }) => s.child.id).sort()).toEqual(
        [kidA1, kidA2].sort(),
      );
    });
  });
});
