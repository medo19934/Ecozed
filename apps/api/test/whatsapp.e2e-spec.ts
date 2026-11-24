import type { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { WhatsAppClient } from '../src/modules/whatsapp/whatsapp.client';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.PUBLIC_DEMO = 'false';
process.env.WHATSAPP_SIMULATOR = 'true';
process.env.WHATSAPP_APP_SECRET = 'test-secret';
process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me';

/** WhatsApp agent: admin's message → proposed changes → «تم» applies them (same rules as the assistant). */
describe('WhatsApp agent (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  const phone = `9665${String(u).slice(-8)}`;
  let branch: string;
  const say = async (from: string, text: string) =>
    (
      (await http.post('/api/v1/whatsapp/simulate').send({ from, text }).expect(200)).body
        .replies as string[]
    ).join('\n');

  beforeAll(async () => {
    const f = await import('./app.factory');
    app = await f.createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    branch = (await prisma.raw.daycare.create({ data: { name: `واتساب ${u}`, slug: `wa-${u}` } }))
      .id;
    const boss = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: f.googleToken('boss@latif.test', 'g-boss') })
        .expect(200)
    ).body as AuthResponse;
    const admin = (
      await http
        .post('/api/v1/auth/switch-daycare')
        .set({ Authorization: `Bearer ${boss.tokens.accessToken}` })
        .send({ daycareId: branch })
        .expect(200)
    ).body.tokens.accessToken as string;
    await http
      .post('/api/v1/users')
      .set({ Authorization: `Bearer ${admin}` })
      .send({ role: 'MANAGER', fullName: 'مديرة واتساب', phone: `+${phone}` })
      .expect(201);
  });
  afterAll(() => app.close());

  it('ignores numbers that are not a registered manager', async () => {
    expect(await say('966500000009', 'أضف فصل Duck Class')).toMatch(/غير مسجّل/);
  });

  it('proposes changes, saves only after «تم»', async () => {
    const plan = await say(
      phone,
      'أضف فصل Monkey Class بسعة 12\nأضف معلمة اسمها سارة wa-s' +
        u +
        '@example.com في فصل Monkey Class',
    );
    expect(plan).toMatch(/إضافة فصل «Monkey Class» بسعة 12/);
    expect(plan).toMatch(/ردّ «تم»/);
    expect(
      await prisma.raw.classroom.count({ where: { daycareId: branch, name: 'Monkey Class' } }),
    ).toBe(0);
    const done = await say(phone, 'تم');
    expect(done).toMatch(/تم حفظ 2 من 2/);
    expect(done).toMatch(/كلمات مرور مؤقتة/);
    expect(
      await prisma.raw.classroom.count({ where: { daycareId: branch, name: 'Monkey Class' } }),
    ).toBe(1);
    expect(await say(phone, 'تم')).toMatch(/ما فيه تغييرات/);
  });

  it('«إلغاء» drops the pending list', async () => {
    await say(phone, 'أضف فصل Bear Class');
    expect(await say(phone, 'إلغاء')).toMatch(/تم الإلغاء/);
    expect(
      await prisma.raw.classroom.count({ where: { daycareId: branch, name: 'Bear Class' } }),
    ).toBe(0);
  });

  it("the real webhook needs Meta's signature and handles each message once", async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: `wamid-${u}`, from: phone, type: 'text', text: { body: 'مساعدة' } },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(payload);
    await http
      .post('/api/v1/whatsapp/webhook')
      .set('content-type', 'application/json')
      .send(raw)
      .expect(401);
    const sig = `sha256=${createHmac('sha256', 'test-secret').update(raw).digest('hex')}`;
    const outbox = app.get(WhatsAppClient).outbox;
    const before = outbox.length;
    for (let i = 0; i < 2; i++) {
      await http
        .post('/api/v1/whatsapp/webhook')
        .set('content-type', 'application/json')
        .set('x-hub-signature-256', sig)
        .send(raw)
        .expect(200);
    }
    expect(outbox.length - before).toBe(1);
    await http
      .get('/api/v1/whatsapp/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': 'abc' })
      .expect(200, 'abc');
  });
});
