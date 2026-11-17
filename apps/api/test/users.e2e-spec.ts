import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse, IssuedPassword, ManagedUser } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';

// Real mode: new users sign in with the temporary password they were given.
process.env.PUBLIC_DEMO = 'false';
let googleToken: (email: string, sub: string) => string;

/**
 * Settings > Users and Settings > Modules, as 4 real people:
 * general admin, branch manager, teacher and parent — all created through the Users screen API.
 */
describe('User management + module switches (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = async (identifier: string, password: string): Promise<AuthResponse> =>
    (await http.post('/api/v1/auth/login').send({ identifier, password }).expect(200)).body;

  let branchA: string, branchB: string, classA: string, classB: string, kidA: string, kidA2: string;
  let adminA: string;
  let managerM: ManagedUser, teacherM: ManagedUser, parentM: ManagedUser;
  let manager: AuthResponse, teacher: AuthResponse, parent: AuthResponse;

  /** Same as the API's per-request client: restricted role + verified user id. */
  const asUser = async (userId: string, sql: string) => {
    const [, rows] = await prisma.raw.$transaction([
      prisma.raw
        .$executeRaw`SELECT set_config('role', 'latif_rls', true), set_config('app.user_id', ${userId}, true)`,
      prisma.raw.$queryRawUnsafe<{ id: string }[]>(sql),
    ]);
    return rows;
  };
  const create = async (token: string, body: object, status = 201) =>
    (await http.post('/api/v1/users').set(bearer(token)).send(body).expect(status)).body as {
      user: ManagedUser;
      issued: IssuedPassword | null;
    };

  beforeAll(async () => {
    const f = await import('./app.factory');
    googleToken = f.googleToken;
    app = await f.createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    branchA = (
      await prisma.raw.daycare.create({ data: { name: `مستخدمون أ ${u}`, slug: `us-a-${u}` } })
    ).id;
    branchB = (
      await prisma.raw.daycare.create({ data: { name: `مستخدمون ب ${u}`, slug: `us-b-${u}` } })
    ).id;
    const boss = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken('boss@latif.test', 'g-boss') })
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
    adminA = await sw(branchA);
    const adminB = await sw(branchB);
    classA = (
      await http
        .post('/api/v1/classes')
        .set(bearer(adminA))
        .send({ name: 'A', capacity: 10 })
        .expect(201)
    ).body.id;
    classB = (
      await http
        .post('/api/v1/classes')
        .set(bearer(adminB))
        .send({ name: 'B', capacity: 10 })
        .expect(201)
    ).body.id;
    const child = async (token: string, name: string, classroomId: string) =>
      (
        await http
          .post('/api/v1/children')
          .set(bearer(token))
          .send({
            fullName: name,
            gender: 'FEMALE',
            birthDate: '2022-02-02',
            classroomId,
            guardians: [
              {
                fullName: 'ولي',
                relationship: 'أب',
                email: `us-g-${name.length}-${classroomId.slice(0, 6)}-${u}@example.com`,
              },
            ],
          })
          .expect(201)
      ).body.id as string;
    kidA = await child(adminA, 'طفلة أ', classA);
    kidA2 = await child(adminA, 'طفلة أ2', classA);
    await child(adminB, 'طفلة ب', classB);
  });
  afterAll(() => app.close());

  it('general admin creates a manager, a teacher and a parent; each signs in with the temp password', async () => {
    const m = await create(adminA, {
      role: 'MANAGER',
      fullName: 'مديرة الفرع',
      email: `us-m${u}@example.com`,
    });
    const t = await create(adminA, {
      role: 'STAFF',
      fullName: 'معلمة',
      email: `us-t${u}@example.com`,
      classIds: [classA],
    });
    const p = await create(adminA, {
      role: 'PARENT',
      fullName: 'أم',
      phone: `05${String(u).slice(-8)}`,
      children: [{ childId: kidA, relationship: 'أم' }],
    });
    for (const x of [m, t, p]) expect(x.issued?.tempPassword).toHaveLength(10);
    expect(t.user.classes.map((c) => c.id)).toEqual([classA]);
    expect(p.user.children.map((c) => c.id)).toEqual([kidA]);
    [managerM, teacherM, parentM] = [m.user, t.user, p.user];
    manager = await login(`us-m${u}@example.com`, m.issued!.tempPassword);
    teacher = await login(`us-t${u}@example.com`, t.issued!.tempPassword);
    parent = await login(`05${String(u).slice(-8)}`, p.issued!.tempPassword);
    expect(manager.user.role).toBe('MANAGER');
    expect(teacher.user.role).toBe('STAFF');
    expect(parent.user.role).toBe('PARENT');
  });

  it('each new user sees only their own data', async () => {
    const kidsOf = async (token: string) =>
      (
        (await http.get('/api/v1/children?pageSize=100').set(bearer(token)).expect(200)).body
          .items as { id: string }[]
      )
        .map((k) => k.id)
        .sort();
    expect(await kidsOf(manager.tokens.accessToken)).toEqual([kidA, kidA2].sort());
    expect(await kidsOf(teacher.tokens.accessToken)).toEqual([kidA, kidA2].sort());
    const mine = (
      await http.get('/api/v1/parent/children').set(bearer(parent.tokens.accessToken)).expect(200)
    ).body as { id: string }[];
    expect(mine.map((k) => k.id)).toEqual([kidA]);
    // Teachers and parents never reach the Users screen.
    await http.get('/api/v1/users').set(bearer(teacher.tokens.accessToken)).expect(403);
    await http.get('/api/v1/users').set(bearer(parent.tokens.accessToken)).expect(403);
    // The manager's list holds only teachers and parents of their branch.
    const list = (
      await http
        .get('/api/v1/users?pageSize=100')
        .set(bearer(manager.tokens.accessToken))
        .expect(200)
    ).body.items as ManagedUser[];
    expect(list.every((x) => x.branch.id === branchA && x.role !== 'MANAGER')).toBe(true);
    expect(list.map((x) => x.membershipId).sort()).toEqual(
      [teacherM.membershipId, parentM.membershipId].sort(),
    );
  });

  it('a branch manager cannot create a manager, act on another branch, or bypass it in the database', async () => {
    const tok = manager.tokens.accessToken;
    await create(
      tok,
      { role: 'MANAGER', fullName: 'مديرة أخرى', email: `us-m2${u}@example.com` },
      403,
    );
    // A daycareId from the client is ignored: the user lands in the manager's own branch.
    const own = await create(tok, {
      role: 'STAFF',
      fullName: 'معلمة 2',
      email: `us-t2${u}@example.com`,
      daycareId: branchB,
    });
    expect(own.user.branch.id).toBe(branchA);
    await http
      .patch(`/api/v1/users/${teacherM.membershipId}`)
      .set(bearer(tok))
      .send({ role: 'MANAGER' })
      .expect(403);
    await http
      .patch(`/api/v1/users/${teacherM.membershipId}`)
      .set(bearer(tok))
      .send({ daycareId: branchB })
      .expect(403);
    await http.post(`/api/v1/users/${managerM.membershipId}/password`).set(bearer(tok)).expect(403);
    // Database (RLS): the same inserts made directly as the manager are refused.
    const uid = manager.user.id;
    const someone = await prisma.raw.user.create({
      data: { fullName: 'x', email: `us-x${u}@example.com` },
    });
    await expect(
      asUser(
        uid,
        `INSERT INTO "Membership" (id,"daycareId","userId",role,"updatedAt") VALUES (gen_random_uuid(),'${branchB}','${someone.id}','STAFF',now()) RETURNING id`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(
        uid,
        `INSERT INTO "Membership" (id,"daycareId","userId",role,"updatedAt") VALUES (gen_random_uuid(),'${branchA}','${someone.id}','MANAGER',now()) RETURNING id`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(
        uid,
        `UPDATE "Membership" SET role='MANAGER' WHERE id='${teacherM.membershipId}' RETURNING id`,
      ),
    ).rejects.toThrow(/row-level security/);
    // …while a teacher in the own branch is allowed.
    expect(
      await asUser(
        uid,
        `INSERT INTO "Membership" (id,"daycareId","userId",role,"updatedAt") VALUES (gen_random_uuid(),'${branchA}','${someone.id}','STAFF',now()) RETURNING id`,
      ),
    ).toHaveLength(1);
  });

  it('edits apply at once without signing in again', async () => {
    await http
      .patch(`/api/v1/users/${teacherM.membershipId}`)
      .set(bearer(manager.tokens.accessToken))
      .send({ fullName: 'معلمة معدلة', classIds: [] })
      .expect(200);
    const kids = (
      await http
        .get('/api/v1/children?pageSize=100')
        .set(bearer(teacher.tokens.accessToken))
        .expect(200)
    ).body.items;
    expect(kids).toHaveLength(0);
    const me = (
      await http.get('/api/v1/auth/me').set(bearer(teacher.tokens.accessToken)).expect(200)
    ).body;
    expect(me.fullName).toBe('معلمة معدلة');
  });

  it('a deactivated user is locked out at once (same token), records are kept, and can be reactivated', async () => {
    const tok = parent.tokens.accessToken;
    await http
      .post(`/api/v1/users/${parentM.membershipId}/deactivate`)
      .set(bearer(manager.tokens.accessToken))
      .expect(200);
    const r = await http.get('/api/v1/parent/children').set(bearer(tok)).expect(401);
    expect(r.body.code ?? r.body.message).toBeDefined();
    await http
      .post('/api/v1/auth/login')
      .send({ identifier: `05${String(u).slice(-8)}`, password: 'whatever-1' })
      .expect(401);
    expect(await asUser(parent.user.id, `SELECT id FROM "Child" WHERE id='${kidA}'`)).toHaveLength(
      0,
    );
    expect(
      await prisma.raw.childGuardian.count({ where: { childId: kidA, userId: parent.user.id } }),
    ).toBe(1);
    await http
      .post(`/api/v1/users/${parentM.membershipId}/reactivate`)
      .set(bearer(manager.tokens.accessToken))
      .expect(200);
    await http.get('/api/v1/parent/children').set(bearer(tok)).expect(200);
  });

  it('deleting someone with records is refused; without records it works', async () => {
    const r = await http
      .delete(`/api/v1/users/${parentM.membershipId}`)
      .set(bearer(manager.tokens.accessToken))
      .expect(409);
    expect(r.body.code).toBe('has_records');
    const fresh = await create(manager.tokens.accessToken, {
      role: 'STAFF',
      fullName: 'مؤقت',
      email: `us-tmp${u}@example.com`,
    });
    await http
      .delete(`/api/v1/users/${fresh.user.membershipId}`)
      .set(bearer(manager.tokens.accessToken))
      .expect(200);
    expect(await prisma.raw.user.count({ where: { email: `us-tmp${u}@example.com` } })).toBe(0);
  });

  it('link / unlink children, reset password, move a child; everything is in the audit log', async () => {
    const tok = manager.tokens.accessToken;
    const linked = (
      await http
        .post(`/api/v1/users/${parentM.membershipId}/children`)
        .set(bearer(tok))
        .send({ childId: kidA2, relationship: 'خالة' })
        .expect(200)
    ).body as ManagedUser;
    expect(linked.children.map((c) => c.id).sort()).toEqual([kidA, kidA2].sort());
    await http
      .delete(`/api/v1/users/${parentM.membershipId}/children/${kidA2}`)
      .set(bearer(tok))
      .expect(200);
    const issued = (
      await http
        .post(`/api/v1/users/${teacherM.membershipId}/password`)
        .set(bearer(tok))
        .expect(200)
    ).body as IssuedPassword;
    await login(`us-t${u}@example.com`, issued.tempPassword);
    // Manager: another class of the own branch is fine, another branch is not.
    await http
      .post(`/api/v1/users/children/${kidA2}/move`)
      .set(bearer(tok))
      .send({ daycareId: branchB })
      .expect(403);
    await http
      .post(`/api/v1/users/children/${kidA2}/move`)
      .set(bearer(tok))
      .send({ classroomId: classA })
      .expect(200);
    // Only the general admin reads the audit trail.
    await http.get('/api/v1/users/audit').set(bearer(tok)).expect(403);
    const audit = (
      await http.get('/api/v1/users/audit?pageSize=100').set(bearer(adminA)).expect(200)
    ).body.items as { action: string; actor: string | null }[];
    const actions = new Set(audit.map((a) => a.action));
    for (const a of [
      'users.create',
      'users.update',
      'users.deactivate',
      'users.reactivate',
      'users.delete',
      'users.password_reset',
      'users.link_child',
      'users.unlink_child',
      'users.move_child',
    ]) {
      expect(actions).toContain(a);
    }
    expect(audit.every((a) => a.actor)).toBe(true);
  });

  it('a switched-off module is hidden, its routes blocked and its data denied for that branch only', async () => {
    await http
      .put('/api/v1/branches/current/features')
      .set(bearer(adminA))
      .send({
        features: [
          { key: 'dailyReports', enabled: false },
          { key: 'units', enabled: false },
        ],
      })
      .expect(200);
    const me = (
      await http.get('/api/v1/auth/me').set(bearer(manager.tokens.accessToken)).expect(200)
    ).body;
    expect(me.features.dailyReports).toBe(false);
    expect(me.features.units).toBe(false);
    expect(me.features.messages).toBe(true);
    const off = await http
      .get('/api/v1/daily-reports')
      .set(bearer(manager.tokens.accessToken))
      .expect(403);
    expect(off.body.code).toBe('feature_disabled');
    await http.get('/api/v1/units').set(bearer(manager.tokens.accessToken)).expect(403);
    await http.get('/api/v1/daily-reports/mine').set(bearer(parent.tokens.accessToken)).expect(403);
    // Database: no report rows for branch A while the module is off.
    await prisma.raw.dailyReport.create({
      data: {
        daycareId: branchA,
        childId: kidA,
        date: new Date('2026-11-10'),
        authorId: manager.user.id,
      },
    } as never);
    expect(
      await asUser(manager.user.id, `SELECT id FROM "DailyReport" WHERE "daycareId"='${branchA}'`),
    ).toHaveLength(0);
    // Turning it back on brings everything back (data kept).
    await http
      .put('/api/v1/branches/current/features')
      .set(bearer(adminA))
      .send({ features: [{ key: 'dailyReports', enabled: true }] })
      .expect(200);
    await http.get('/api/v1/daily-reports').set(bearer(manager.tokens.accessToken)).expect(200);
    expect(
      await asUser(manager.user.id, `SELECT id FROM "DailyReport" WHERE "daycareId"='${branchA}'`),
    ).toHaveLength(1);
  });
});
