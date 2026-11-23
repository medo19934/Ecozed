import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.PUBLIC_DEMO = 'false';

/** A teacher linked to a class, with "add child" permission, adds a child and then sees it. */
describe('Teacher adds a child (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const f = await import('./app.factory');
    app = await f.createTestApp();
    http = request(app.getHttpServer());
    const prisma = app.get(PrismaService);
    const branch = (
      await prisma.raw.daycare.create({ data: { name: `معلمة ${u}`, slug: `tac-${u}` } })
    ).id;
    const boss = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: f.googleToken('boss@latif.test', 'g-boss') })
        .expect(200)
    ).body as AuthResponse;
    const admin = (
      await http
        .post('/api/v1/auth/switch-daycare')
        .set(bearer(boss.tokens.accessToken))
        .send({ daycareId: branch })
        .expect(200)
    ).body.tokens.accessToken as string;
    const cls = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'Duck Class', capacity: 20 })
        .expect(201)
    ).body.id;
    const t = (
      await http
        .post('/api/v1/users')
        .set(bearer(admin))
        .send({ role: 'STAFF', fullName: 'معلمة', email: `tac${u}@example.com`, classIds: [cls] })
        .expect(201)
    ).body;
    await http
      .patch(`/api/v1/staff/${t.user.membershipId}`)
      .set(bearer(admin))
      .send({ permissions: ['canAddChild', 'canManageAttendance'] })
      .expect(200);
    const login = (
      await http
        .post('/api/v1/auth/login')
        .send({ identifier: `tac${u}@example.com`, password: t.issued.tempPassword })
        .expect(200)
    ).body as AuthResponse;
    Object.assign(globalThis, { __teacher: login.tokens.accessToken, __cls: cls });
  });
  afterAll(() => app.close());

  it('teacher with class + permission can add a child and sees it in her list', async () => {
    const tok = (globalThis as unknown as { __teacher: string }).__teacher;
    const cls = (globalThis as unknown as { __cls: string }).__cls;
    expect((await http.get('/api/v1/classes').set(bearer(tok)).expect(200)).body).toHaveLength(1);
    const kid = await http
      .post('/api/v1/children')
      .set(bearer(tok))
      .send({
        fullName: 'جود',
        gender: 'FEMALE',
        birthDate: '2022-03-01',
        classroomId: cls,
        guardians: [{ fullName: 'أم جود', relationship: 'أم', phone: '0501112233' }],
      })
      .expect(201);
    const list = (await http.get('/api/v1/children?pageSize=50').set(bearer(tok)).expect(200)).body
      .items as { id: string }[];
    expect(list.map((k) => k.id)).toContain(kid.body.id);
    await http
      .post(`/api/v1/attendance/children/${kid.body.id}`)
      .set(bearer(tok))
      .send({ action: 'CHECK_IN' })
      .expect(200);
  });
});
