import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { RequestContext } from '../src/common/context/request-context';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

describe('Google auth flow (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const uniq = Date.now();
  const branchIds: string[] = [];
  const google = (email: string, sub: string) =>
    http.post('/api/v1/auth/google').send({ idToken: googleToken(email, sub) });

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    for (const n of ['A', 'B']) {
      const b = await prisma.raw.daycare.create({
        data: { name: `Branch ${n} ${uniq}`, slug: `b-${n}-${uniq}` },
      });
      branchIds.push(b.id);
    }
  });
  afterAll(() => app.close());

  it('GET /health', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.body.db).toBe('up');
  });

  it('rejects invalid Google tokens', async () => {
    const res = await http
      .post('/api/v1/auth/google')
      .send({ idToken: 'not-a-google-token-at-all' })
      .expect(401);
    expect(res.body.code).toBe('invalid_google_token');
  });

  it('validates input with shared zod schemas', async () => {
    const res = await http.post('/api/v1/auth/google').send({ idToken: 'x' }).expect(400);
    expect(res.body.code).toBe('validation_error');
  });

  let parent: AuthResponse;
  it('signs up a parent with Google (no codes)', async () => {
    const res = await google(`mom${uniq}@example.com`, `g-mom-${uniq}`).expect(200);
    parent = res.body;
    expect(parent.user.role).toBe('PARENT');
    expect(parent.user.daycareId).toBeNull();
    expect(parent.user.memberships).toEqual([]);
    // Second sign-in reuses the same account.
    const again = await google(`mom${uniq}@example.com`, `g-mom-${uniq}`).expect(200);
    expect(again.body.user.id).toBe(parent.user.id);
  });

  it('parent can read /me but not staff-only areas', async () => {
    const res = await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${parent.tokens.accessToken}`)
      .expect(200);
    expect(res.body.role).toBe('PARENT');
    await http.get('/api/v1/auth/me').expect(401);
  });

  it('links Google to a staff account an admin created (by email)', async () => {
    const staff = await prisma.raw.user.create({
      data: {
        fullName: 'Teacher Huda',
        email: `huda${uniq}@example.com`,
        memberships: {
          create: { daycareId: branchIds[0]!, role: 'STAFF', permissions: ['canViewMessages'] },
        },
      },
    });
    const res = await google(`huda${uniq}@example.com`, `g-huda-${uniq}`).expect(200);
    expect(res.body.user.id).toBe(staff.id);
    expect(res.body.user.role).toBe('STAFF');
    expect(res.body.user.daycareId).toBe(branchIds[0]);
    expect(res.body.user.permissions).toEqual(['canViewMessages']);
    const linked = await prisma.raw.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(linked.googleId).toBe(`g-huda-${uniq}`);
  });

  let admin: AuthResponse;
  it('grants super admin to SUPER_ADMIN_EMAILS and lists every branch', async () => {
    const res = await google('boss@latif.test', 'g-boss').expect(200);
    admin = res.body;
    expect(admin.user.role).toBe('SUPER_ADMIN');
    const ids = admin.user.memberships.map((m) => m.daycareId);
    expect(ids).toEqual(expect.arrayContaining(branchIds));
  });

  it('super admin can switch to any branch; others only their own', async () => {
    const res = await http
      .post('/api/v1/auth/switch-daycare')
      .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
      .send({ daycareId: branchIds[1] })
      .expect(200);
    expect(res.body.user.daycareId).toBe(branchIds[1]);
    const me = await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body.daycareId).toBe(branchIds[1]);

    await http
      .post('/api/v1/auth/switch-daycare')
      .set('Authorization', `Bearer ${parent.tokens.accessToken}`)
      .send({ daycareId: branchIds[1] })
      .expect(401);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const first = parent.tokens.refreshToken;
    const res = await http.post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    const second = res.body.tokens.refreshToken;
    expect(second).not.toBe(first);
    await http.post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    await http.post('/api/v1/auth/refresh').send({ refreshToken: second }).expect(401);
  });

  it('logs out (revokes refresh token)', async () => {
    const login = await google(`mom${uniq}@example.com`, `g-mom-${uniq}`).expect(200);
    const { refreshToken } = login.body.tokens;
    await http.post('/api/v1/auth/logout').send({ refreshToken }).expect(200);
    await http.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('dev login is off unless AUTH_DEV_LOGIN=true', async () => {
    await http.post('/api/v1/auth/dev-login').send({ email: 'x@y.co' }).expect(404);
  });

  it('writes audit logs for sign-ups', async () => {
    const logs = await prisma.raw.auditLog.findMany({ where: { entityId: parent.user.id } });
    expect(logs.map((a) => a.action)).toContain('auth.signup_parent');
  });

  it('scoped client isolates branches and fails closed without context', async () => {
    await prisma.raw.membership.create({
      data: { daycareId: branchIds[1]!, userId: parent.user.id, role: 'PARENT' },
    });
    await expect(prisma.scoped.membership.findMany()).rejects.toThrow('No active daycare');
    const rows = await RequestContext.run(
      { requestId: 't', daycareId: branchIds[0] },
      // Prisma queries are lazy: await inside the context so it is captured.
      async () => await prisma.scoped.membership.findMany({ where: { daycareId: branchIds[1] } }),
    );
    expect(rows.every((r) => r.daycareId === branchIds[0])).toBe(true);
  });
});
