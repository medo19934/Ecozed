import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { RequestContext } from '../src/common/context/request-context';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './app.factory';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const uniq = Date.now();
  const owner = {
    fullName: 'Sara Owner',
    email: `sara${uniq}@example.com`,
    phone: `+9665${String(uniq).slice(-8)}`,
    password: 'secret-pass-1',
    daycareName: 'Little Stars',
  };
  let session: AuthResponse;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });
  afterAll(() => app.close());

  it('GET /health', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.body.db).toBe('up');
  });

  it('registers an owner + daycare (onboarding step 1)', async () => {
    const res = await http.post('/api/v1/auth/register').send(owner).expect(201);
    session = res.body;
    expect(session.user.role).toBe('OWNER');
    expect(session.user.locale).toBe('ar');
    expect(session.user.daycareId).toBeTruthy();
    expect(session.user.features.messages).toBe(true);
    expect(session.tokens.accessToken).toBeTruthy();
  });

  it('rejects duplicate registration', async () => {
    await http.post('/api/v1/auth/register').send(owner).expect(409);
  });

  it('validates input with shared zod schemas', async () => {
    const res = await http
      .post('/api/v1/auth/register')
      .send({ ...owner, email: 'nope' })
      .expect(400);
    expect(res.body.code).toBe('validation_error');
    expect(res.body.errors[0].path).toBe('email');
  });

  it('logs in by email and by phone', async () => {
    const login = (identifier: string, password: string) =>
      http.post('/api/v1/auth/login').send({ identifier, password });
    await login(owner.email, owner.password).expect(200);
    await login(owner.phone, owner.password).expect(200);
    await login(owner.email, 'wrong-pass').expect(401);
  });

  it('protects /me and returns the auth user', async () => {
    await http.get('/api/v1/auth/me').expect(401);
    const res = await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(owner.email);
    expect(res.body.permissions).toContain('canAddChild');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const first = session.tokens.refreshToken;
    const res = await http.post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    const second = res.body.tokens.refreshToken;
    expect(second).not.toBe(first);
    // Reusing the old token revokes the family, so the new one dies too.
    await http.post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    await http.post('/api/v1/auth/refresh').send({ refreshToken: second }).expect(401);
  });

  it('logs out (revokes refresh token)', async () => {
    const login = await http
      .post('/api/v1/auth/login')
      .send({ identifier: owner.email, password: owner.password })
      .expect(200);
    const { refreshToken } = login.body.tokens;
    await http.post('/api/v1/auth/logout').send({ refreshToken }).expect(200);
    await http.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('passwordless OTP login by phone (single use)', async () => {
    const otp = await http
      .post('/api/v1/auth/otp/request')
      .send({ identifier: owner.phone, purpose: 'LOGIN' })
      .expect(200);
    const code: string = otp.body.devCode;
    expect(code).toMatch(/^\d{6}$/);
    const wrong = code === '000000' ? '111111' : '000000';
    const verify = (c: string) =>
      http.post('/api/v1/auth/otp/verify').send({ identifier: owner.phone, code: c });
    await verify(wrong).expect(401);
    const res = await verify(code).expect(200);
    expect(res.body.user.email).toBe(owner.email);
    await verify(code).expect(401);
  });

  it('does not reveal unknown accounts on OTP request', async () => {
    const res = await http
      .post('/api/v1/auth/otp/request')
      .send({ identifier: '+966599999999', purpose: 'LOGIN' })
      .expect(200);
    expect(res.body).toEqual({ sent: true });
  });

  it('forgot + reset password', async () => {
    const forgot = await http
      .post('/api/v1/auth/password/forgot')
      .send({ identifier: owner.email })
      .expect(200);
    await http
      .post('/api/v1/auth/password/reset')
      .send({ identifier: owner.email, code: forgot.body.devCode, password: 'new-secret-2' })
      .expect(200);
    const login = (password: string) =>
      http.post('/api/v1/auth/login').send({ identifier: owner.email, password });
    await login(owner.password).expect(401);
    await login('new-secret-2').expect(200);
  });

  it('writes audit logs for sensitive actions', async () => {
    const prisma = app.get(PrismaService);
    const logs = await prisma.raw.auditLog.findMany({
      where: { daycareId: session.user.daycareId },
    });
    expect(logs.map((a) => a.action)).toContain('auth.register');
  });

  it('scoped client isolates tenants and fails closed without context', async () => {
    const prisma = app.get(PrismaService);
    const other = await http
      .post('/api/v1/auth/register')
      .send({
        ...owner,
        email: `other${uniq}@example.com`,
        phone: `+9665${String(uniq + 1).slice(-8)}`,
      })
      .expect(201);

    await expect(prisma.scoped.membership.findMany()).rejects.toThrow('No active daycare');

    const rows = await RequestContext.run(
      { requestId: 't', daycareId: session.user.daycareId },
      // Prisma queries are lazy: await inside the context so it is captured.
      async () =>
        await prisma.scoped.membership.findMany({
          where: { daycareId: other.body.user.daycareId },
        }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.daycareId).toBe(session.user.daycareId);
  });

  it('switches daycare only when a member', async () => {
    await http
      .post('/api/v1/auth/switch-daycare')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ daycareId: '00000000-0000-4000-8000-000000000000' })
      .expect(401);
  });
});
