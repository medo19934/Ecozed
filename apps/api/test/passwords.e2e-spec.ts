import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

// Real mode: email/phone + password (no demo shortcuts).
process.env.PUBLIC_DEMO = 'false';
let googleToken: (email: string, sub: string) => string;

describe('Password sign-in (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: string;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (identifier: string, password?: string) =>
    http.post('/api/v1/auth/login').send({ identifier, password });

  beforeAll(async () => {
    // Config is validated when the app module is first loaded: load it after setting the env.
    const f = await import('./app.factory');
    googleToken = f.googleToken;
    const { createTestApp } = f;
    app = await createTestApp();
    http = request(app.getHttpServer());
    const prisma = app.get(PrismaService);
    const branchId = (
      await prisma.raw.daycare.create({ data: { name: `كلمات ${u}`, slug: `pw-${u}` } })
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
  });
  afterAll(() => app.close());

  it('parents register and sign in; wrong or missing password is refused', async () => {
    const phone = `05${String(u).slice(-8)}`;
    const reg = await http
      .post('/api/v1/auth/register')
      .send({ fullName: 'أم سعد', identifier: phone, password: 'secret-123' })
      .expect(200);
    expect(reg.body.user).toMatchObject({ role: 'PARENT', mustChangePassword: false });
    await http
      .post('/api/v1/auth/register')
      .send({ fullName: 'x y', identifier: phone, password: 'secret-123' })
      .expect(409);
    await login(phone, 'wrong-pass').expect(401);
    await login(phone).expect(401);
    await login(`stranger${u}@example.com`, 'secret-123').expect(401);
    await login(`+966${phone.slice(1)}`, 'secret-123').expect(200);
    await http
      .post('/api/v1/auth/register')
      .send({ fullName: 'x y', identifier: `a${u}@example.com`, password: 'short' })
      .expect(400);
  });

  it('new staff get a one-time password and must change it', async () => {
    const res = await http
      .post('/api/v1/staff')
      .set(bearer(admin))
      .send({ email: `pw-t${u}@example.com`, fullName: 'معلمة' })
      .expect(201);
    const temp = res.body.issued.tempPassword as string;
    expect(temp).toHaveLength(10);
    const s = await login(`pw-t${u}@example.com`, temp).expect(200);
    expect(s.body.user).toMatchObject({ role: 'STAFF', mustChangePassword: true });
    await http
      .post('/api/v1/auth/password')
      .set(bearer(s.body.tokens.accessToken))
      .send({ newPassword: 'teacher-pass' })
      .expect(200);
    await login(`pw-t${u}@example.com`, temp).expect(401);
    const again = await login(`pw-t${u}@example.com`, 'teacher-pass').expect(200);
    expect(again.body.user.mustChangePassword).toBe(false);
    // Changing it again needs the current password.
    await http
      .post('/api/v1/auth/password')
      .set(bearer(again.body.tokens.accessToken))
      .send({ newPassword: 'another-pass' })
      .expect(400);
    // Admin reset.
    const reset = await http
      .post(`/api/v1/staff/${res.body.membershipId}/password`)
      .set(bearer(admin));
    if (reset.status !== 201) console.log('RESET', reset.status, JSON.stringify(reset.body));
    expect(reset.status).toBe(201);
    await login(`pw-t${u}@example.com`, reset.body.tempPassword).expect(200);
  });

  it('adding a parent issues a login that sees their child', async () => {
    const kid = (
      await http
        .post('/api/v1/children')
        .set(bearer(admin))
        .send({
          fullName: 'طفل',
          gender: 'MALE',
          birthDate: '2022-01-01',
          guardians: [{ fullName: 'أم', relationship: 'أم', email: `pw-m${u}@example.com` }],
        })
        .expect(201)
    ).body.id;
    const added = await http
      .post('/api/v1/parents')
      .set(bearer(admin))
      .send({
        fullName: 'أب',
        relationship: 'أب',
        phone: `05${String(u + 1).slice(-8)}`,
        childIds: [kid],
      })
      .expect(201);
    const p = await login(added.body.phone, added.body.issued.tempPassword).expect(200);
    const kids = await http
      .get('/api/v1/parent/children')
      .set(bearer(p.body.tokens.accessToken))
      .expect(200);
    expect(kids.body.map((k: { id: string }) => k.id)).toEqual([kid]);
    // Login for the guardian saved on the child record.
    const acc = await http
      .post('/api/v1/parents/account')
      .set(bearer(admin))
      .send({ key: `pw-m${u}@example.com` })
      .expect(200);
    const m = await login(`pw-m${u}@example.com`, acc.body.issued.tempPassword).expect(200);
    expect(m.body.user.role).toBe('PARENT');
  });
});
