import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

describe('Messages + email/phone sign-in (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  let branchId: string;
  let admin: string;
  let teacher: string;
  let teacherUserId: string;
  let parent: string;
  let stranger: string;
  let kidA: string;
  let kidB: string;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = async (identifier: string): Promise<AuthResponse> =>
    (await http.post('/api/v1/auth/login').send({ identifier }).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    branchId = (await prisma.raw.daycare.create({ data: { name: `رسائل ${u}`, slug: `p6-${u}` } })).id;
    await prisma.raw.daycareFeature.create({ data: { daycareId: branchId, key: 'messages', enabled: true } });
    const boss = (await http.post('/api/v1/auth/google').send({ idToken: googleToken('boss@latif.test', 'g-boss') }).expect(200)).body;
    admin = (await http.post('/api/v1/auth/switch-daycare').set(bearer(boss.tokens.accessToken)).send({ daycareId: branchId }).expect(200)).body.tokens.accessToken;
    const classA = (await http.post('/api/v1/classes').set(bearer(admin)).send({ name: 'A', capacity: 10 }).expect(201)).body.id;
    const classB = (await http.post('/api/v1/classes').set(bearer(admin)).send({ name: 'B', capacity: 10 }).expect(201)).body.id;
    const t = await http.post('/api/v1/staff').set(bearer(admin)).send({ email: `msg-t${u}@example.com`, fullName: 'معلمة', classIds: [classA] }).expect(201);
    teacherUserId = t.body.userId;
    const phone = `+9665${String(u).slice(-8)}`;
    kidA = (
      await http.post('/api/v1/children').set(bearer(admin))
        .send({ fullName: 'طفل أ', gender: 'MALE', birthDate: '2022-01-01', classroomId: classA, guardians: [{ fullName: 'أم', relationship: 'أم', phone }] })
        .expect(201)
    ).body.id;
    kidB = (
      await http.post('/api/v1/children').set(bearer(admin))
        .send({ fullName: 'طفل ب', gender: 'MALE', birthDate: '2022-01-01', classroomId: classB, guardians: [{ fullName: 'أب', relationship: 'أب', phone: `+9665${String(u + 7).slice(-8)}` }] })
        .expect(201)
    ).body.id;
    teacher = (await login(`msg-t${u}@example.com`)).tokens.accessToken;
    // Parent signs in with the phone the branch registered (local 05 format).
    const p = await login(`0${phone.slice(4)}`);
    expect(p.user.role).toBe('PARENT');
    parent = p.tokens.accessToken;
    stranger = (await login(`stranger${u}@example.com`)).tokens.accessToken;
  });
  afterAll(() => app.close());

  it('email/phone sign-in: demo options and accounts are public', async () => {
    const o = await http.get('/api/v1/auth/options').expect(200);
    expect(o.body.publicDemo).toBe(true);
    await http.post('/api/v1/auth/login').send({ identifier: 'not valid' }).expect(400);
  });

  let threadId: string;
  it('parent and teacher talk in the child thread; others cannot read it', async () => {
    const opened = await http.post('/api/v1/messages/threads').set(bearer(parent)).send({ kind: 'CHILD', childId: kidA }).expect(201);
    threadId = opened.body.id;
    expect(opened.body).toMatchObject({ kind: 'CHILD', title: 'طفل أ', canPost: true });
    await http.post(`/api/v1/messages/threads/${threadId}`).set(bearer(parent)).send({ body: 'السلام عليكم' }).expect(201);
    const tList = await http.get('/api/v1/messages/threads').set(bearer(teacher)).expect(200);
    expect(tList.body.find((x: { id: string }) => x.id === threadId).unread).toBe(1);
    const read = await http.get(`/api/v1/messages/threads/${threadId}`).set(bearer(teacher)).expect(200);
    expect(read.body.messages[0]).toMatchObject({ body: 'السلام عليكم', mine: false });
    await http.post(`/api/v1/messages/threads/${threadId}`).set(bearer(teacher)).send({ body: 'وعليكم السلام' }).expect(201);
    const mine = await http.get(`/api/v1/messages/threads/${threadId}`).set(bearer(parent)).expect(200);
    expect(mine.body.messages.map((m: { body: string }) => m.body)).toEqual(['السلام عليكم', 'وعليكم السلام']);
    expect(mine.body.messages[0].read).toBe(true);
    await http.get(`/api/v1/messages/threads/${threadId}`).set(bearer(stranger)).expect(404);
    await http.post('/api/v1/messages/threads').set(bearer(parent)).send({ kind: 'CHILD', childId: kidB }).expect(403);
    await http.post('/api/v1/messages/threads').set(bearer(teacher)).send({ kind: 'CHILD', childId: kidB }).expect(403);
    const adminRead = await http.get(`/api/v1/messages/threads/${threadId}`).set(bearer(admin)).expect(200);
    expect(adminRead.body.messages).toHaveLength(2);
  });

  it('attachments, staff chat and announcements', async () => {
    const up = await http.post(`/api/v1/messages/threads/${threadId}`).set(bearer(teacher))
      .attach('file', Buffer.from('%PDF-1.4 report'), { filename: 'تقرير.pdf', contentType: 'application/pdf' }).expect(201);
    expect(up.body.attachment.name).toBe('تقرير.pdf');
    await http.get(`/api/v1/messages/threads/${threadId}/files/${up.body.id}`).set(bearer(parent)).expect(200);

    const staff = await http.post('/api/v1/messages/threads').set(bearer(admin)).send({ kind: 'STAFF', userId: teacherUserId }).expect(201);
    await http.post(`/api/v1/messages/threads/${staff.body.id}`).set(bearer(admin)).send({ body: 'اجتماع غدًا' }).expect(201);
    await http.get(`/api/v1/messages/threads/${staff.body.id}`).set(bearer(parent)).expect(404);
    const unread = await http.get('/api/v1/messages/unread').set(bearer(teacher)).expect(200);
    expect(unread.body.unread).toBeGreaterThanOrEqual(1);

    const ann = await http.post('/api/v1/messages/threads').set(bearer(admin)).send({ kind: 'ANNOUNCEMENT', title: 'إعلان مهم' }).expect(201);
    await http.post(`/api/v1/messages/threads/${ann.body.id}`).set(bearer(admin)).send({ body: 'إجازة يوم الأحد' }).expect(201);
    const pList = await http.get('/api/v1/messages/threads?tab=parents').set(bearer(parent)).expect(200);
    const a = pList.body.find((x: { id: string }) => x.id === ann.body.id);
    expect(a).toMatchObject({ kind: 'ANNOUNCEMENT', canPost: false });
    await http.post(`/api/v1/messages/threads/${ann.body.id}`).set(bearer(parent)).send({ body: 'x' }).expect(403);
    await http.post('/api/v1/messages/threads').set(bearer(parent)).send({ kind: 'ANNOUNCEMENT', title: 'nope' }).expect(403);
  });
});
