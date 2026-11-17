import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@latif/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, googleToken } from './app.factory';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Phase 2 — branch, classes, staff, children, parent (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  let branchId: string;
  let admin: string;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const signIn = async (email: string, sub: string): Promise<AuthResponse> =>
    (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken(email, sub) })
        .expect(200)
    ).body;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    const b = await prisma.raw.daycare.create({ data: { name: `فرع ${u}`, slug: `p2-${u}` } });
    branchId = b.id;
    await prisma.raw.daycareFeature.create({
      data: { daycareId: b.id, key: 'messages', enabled: true },
    });
    const boss = await signIn('boss@latif.test', 'g-boss');
    const switched = await http
      .post('/api/v1/auth/switch-daycare')
      .set(bearer(boss.tokens.accessToken))
      .send({ daycareId: branchId })
      .expect(200);
    admin = switched.body.tokens.accessToken;
  });
  afterAll(() => app.close());

  it('branch profile: read, update with geofence, features, logo', async () => {
    const res = await http
      .patch('/api/v1/branches/current')
      .set(bearer(admin))
      .send({
        name: 'فرع الاختبار',
        nameEn: 'Test Branch',
        latitude: 24.77,
        longitude: 46.64,
        geofenceRadiusM: 200,
      })
      .expect(200);
    expect(res.body).toMatchObject({ id: branchId, nameEn: 'Test Branch', geofenceRadiusM: 200 });

    await http
      .patch('/api/v1/branches/current')
      .set(bearer(admin))
      .send({ name: 'x', latitude: 1 })
      .expect(400);

    const f = await http
      .put('/api/v1/branches/current/features')
      .set(bearer(admin))
      .send({ features: [{ key: 'dailyStoryAi', enabled: true }] })
      .expect(200);
    expect(f.body.features).toMatchObject({ messages: true, dailyStoryAi: true });

    await http
      .post('/api/v1/branches/current/logo')
      .set(bearer(admin))
      .attach('file', PNG, 'logo.png')
      .expect(201);
    const logo = await http.get('/api/v1/branches/current/logo').set(bearer(admin)).expect(200);
    expect(logo.headers['content-type']).toContain('image/png');
    await http
      .post('/api/v1/branches/current/logo')
      .set(bearer(admin))
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
  });

  let classA: string;
  let classB: string;
  it('classes CRUD', async () => {
    classA = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'العصافير', capacity: 12 })
        .expect(201)
    ).body.id;
    classB = (
      await http
        .post('/api/v1/classes')
        .set(bearer(admin))
        .send({ name: 'الفراشات', capacity: 10 })
        .expect(201)
    ).body.id;
    await http
      .post('/api/v1/classes')
      .set(bearer(admin))
      .send({ name: 'bad', capacity: 5, minAgeMonths: 40, maxAgeMonths: 20 })
      .expect(400);
    const list = await http.get('/api/v1/classes').set(bearer(admin)).expect(200);
    expect(list.body.map((c: { name: string }) => c.name)).toEqual(
      expect.arrayContaining(['العصافير', 'الفراشات']),
    );
  });

  let teacherMembership: string;
  let teacher: string;
  it('admin creates a teacher by email; teacher links on Google sign-in', async () => {
    const res = await http
      .post('/api/v1/staff')
      .set(bearer(admin))
      .send({
        email: `t${u}@example.com`,
        fullName: 'أ. هدى',
        staffType: 'TEACHER',
        specialties: ['لغة عربية'],
        classIds: [classA],
        permissions: ['canViewMessages'],
      })
      .expect(201);
    teacherMembership = res.body.membershipId;
    expect(res.body).toMatchObject({
      pendingFirstLogin: true,
      role: 'STAFF',
      classes: [{ id: classA }],
    });

    await http
      .post('/api/v1/staff')
      .set(bearer(admin))
      .send({ email: `t${u}@example.com`, fullName: 'dup' })
      .expect(409);

    const t = await signIn(`t${u}@example.com`, `g-t-${u}`);
    expect(t.user).toMatchObject({
      role: 'STAFF',
      daycareId: branchId,
      permissions: ['canViewMessages'],
    });
    teacher = t.tokens.accessToken;

    const list = await http.get('/api/v1/staff').set(bearer(admin)).expect(200);
    const row = list.body.items.find(
      (s: { membershipId: string }) => s.membershipId === teacherMembership,
    );
    expect(row.pendingFirstLogin).toBe(false);
  });

  it('permission toggles are enforced', async () => {
    await http.get('/api/v1/staff').set(bearer(teacher)).expect(403);
    await http
      .post('/api/v1/children')
      .set(bearer(teacher))
      .send({
        fullName: 'x',
        gender: 'MALE',
        birthDate: '2022-01-01',
        guardians: [{ fullName: 'Ab', relationship: 'أب', phone: '+966500000001' }],
      })
      .expect(403);
    await http
      .patch(`/api/v1/staff/${teacherMembership}`)
      .set(bearer(admin))
      .send({ permissions: ['canAddChild', 'canViewMessages'] })
      .expect(200);
    // New permissions apply on the next request (membership is read per request).
    await http
      .post('/api/v1/children')
      .set(bearer(teacher))
      .send({
        fullName: 'طفل المعلمة',
        gender: 'MALE',
        birthDate: '2022-01-01',
        classroomId: classA,
        guardians: [{ fullName: 'ولي', relationship: 'أب', phone: `+9665${String(u).slice(-8)}` }],
      })
      .expect(201);
  });

  let childB: string;
  const momEmail = `mom${u}@example.com`;
  it('children: create with guardians, search, filters, teacher sees own class only', async () => {
    const res = await http
      .post('/api/v1/children')
      .set(bearer(admin))
      .send({
        fullName: 'ليان العتيبي',
        gender: 'FEMALE',
        birthDate: '2021-05-10',
        classroomId: classB,
        allergies: 'فول سوداني',
        pickupPeople: [{ name: 'خالد', relationship: 'عم', phone: '+966511111111' }],
        guardians: [{ fullName: 'أم ليان', relationship: 'أم', email: momEmail, isPrimary: true }],
      })
      .expect(201);
    childB = res.body.id;
    expect(res.body.guardians[0]).toMatchObject({ linked: false, isPrimary: true });

    await http
      .post('/api/v1/children')
      .set(bearer(admin))
      .send({
        fullName: 'no contact',
        gender: 'MALE',
        birthDate: '2021-01-01',
        guardians: [{ fullName: 'Ab', relationship: 'أب' }],
      })
      .expect(400);

    const search = await http
      .get('/api/v1/children')
      .query({ search: 'ليان' })
      .set(bearer(admin))
      .expect(200);
    expect(search.body.total).toBe(1);
    const byClass = await http
      .get('/api/v1/children')
      .query({ classroomId: classA })
      .set(bearer(admin))
      .expect(200);
    expect(
      byClass.body.items.every((c: { classroom: { id: string } }) => c.classroom.id === classA),
    ).toBe(true);

    const teacherList = await http.get('/api/v1/children').set(bearer(teacher)).expect(200);
    expect(teacherList.body.items.map((c: { id: string }) => c.id)).not.toContain(childB);
    await http.get(`/api/v1/children/${childB}`).set(bearer(teacher)).expect(404);
  });

  it('parent signs up later and sees only their linked child', async () => {
    const mom = await signIn(momEmail, `g-mom-${u}`);
    expect(mom.user.role).toBe('PARENT');
    expect(mom.user.daycareId).toBe(branchId);
    const kids = await http
      .get('/api/v1/parent/children')
      .set(bearer(mom.tokens.accessToken))
      .expect(200);
    expect(kids.body).toHaveLength(1);
    expect(kids.body[0]).toMatchObject({
      id: childB,
      classroom: { id: classB },
      branch: { id: branchId },
    });
    await http.get('/api/v1/children').set(bearer(mom.tokens.accessToken)).expect(403);

    const stranger = await signIn(`stranger${u}@example.com`, `g-s-${u}`);
    const none = await http
      .get('/api/v1/parent/children')
      .set(bearer(stranger.tokens.accessToken))
      .expect(200);
    expect(none.body).toEqual([]);

    const detail = await http.get(`/api/v1/children/${childB}`).set(bearer(admin)).expect(200);
    expect(detail.body.guardians[0].linked).toBe(true);
  });

  it('child photo, archive and restore', async () => {
    await http
      .post(`/api/v1/children/${childB}/photo`)
      .set(bearer(admin))
      .attach('file', PNG, 'p.png')
      .expect(201);
    await http.get(`/api/v1/children/${childB}/photo`).set(bearer(admin)).expect(200);
    await http.post(`/api/v1/children/${childB}/archive`).set(bearer(admin)).expect(201);
    const active = await http
      .get('/api/v1/children')
      .query({ search: 'ليان' })
      .set(bearer(admin))
      .expect(200);
    expect(active.body.total).toBe(0);
    const archived = await http
      .get('/api/v1/children')
      .query({ search: 'ليان', status: 'ARCHIVED' })
      .set(bearer(admin))
      .expect(200);
    expect(archived.body.total).toBe(1);
    await http.post(`/api/v1/children/${childB}/restore`).set(bearer(admin)).expect(201);
  });

  it('staff files: upload, download, bin, restore (private)', async () => {
    const up = await http
      .post(`/api/v1/staff/${teacherMembership}/files`)
      .set(bearer(admin))
      .field('category', 'شهادة')
      .attach('file', Buffer.from('%PDF-1.4 test'), {
        filename: 'شهادة صحية.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(up.body.name).toBe('شهادة صحية.pdf');
    const fileId = up.body.id;
    const dl = await http
      .get(`/api/v1/staff/${teacherMembership}/files/${fileId}`)
      .set(bearer(admin))
      .expect(200);
    expect(dl.headers['content-disposition']).toContain('attachment');
    await http
      .get(`/api/v1/staff/${teacherMembership}/files/${fileId}`)
      .set(bearer(teacher))
      .expect(403);

    await http
      .delete(`/api/v1/staff/${teacherMembership}/files/${fileId}`)
      .set(bearer(admin))
      .expect(200);
    const live = await http
      .get(`/api/v1/staff/${teacherMembership}/files`)
      .set(bearer(admin))
      .expect(200);
    expect(live.body).toHaveLength(0);
    const bin = await http
      .get(`/api/v1/staff/${teacherMembership}/files?deleted=true`)
      .set(bearer(admin))
      .expect(200);
    expect(bin.body).toHaveLength(1);
    await http
      .post(`/api/v1/staff/${teacherMembership}/files/${fileId}/restore`)
      .set(bearer(admin))
      .expect(201);
  });

  it('archiving staff revokes access', async () => {
    await http.post(`/api/v1/staff/${teacherMembership}/archive`).set(bearer(admin)).expect(201);
    await http.get('/api/v1/classes').set(bearer(teacher)).expect(401);
    await http.post(`/api/v1/staff/${teacherMembership}/restore`).set(bearer(admin)).expect(201);
  });

  it('only super admins create branch managers', async () => {
    const mgr = await http
      .post('/api/v1/staff')
      .set(bearer(admin))
      .send({
        email: `mgr${u}@example.com`,
        fullName: 'مديرة',
        role: 'MANAGER',
        staffType: 'ADMIN',
      })
      .expect(201);
    const manager = await signIn(`mgr${u}@example.com`, `g-mgr-${u}`);
    expect(manager.user.role).toBe('MANAGER');
    await http
      .post('/api/v1/staff')
      .set(bearer(manager.tokens.accessToken))
      .send({ email: `mgr2${u}@example.com`, fullName: 'مديرة ثانية', role: 'MANAGER' })
      .expect(403);
    await http
      .patch(`/api/v1/staff/${mgr.body.membershipId}`)
      .set(bearer(manager.tokens.accessToken))
      .send({ permissions: [] })
      .expect(403);
  });

  it('TEST data button creates and clears flagged rows', async () => {
    const created = await http.post('/api/v1/test-data').set(bearer(admin)).expect(201);
    expect(created.body).toEqual({ classes: 3, children: 12, staff: 4 });
    const kids = await http
      .get('/api/v1/children')
      .query({ search: 'TEST', pageSize: 50 })
      .set(bearer(admin))
      .expect(200);
    expect(kids.body.items.every((c: { isTest: boolean }) => c.isTest)).toBe(true);
    await http.post('/api/v1/test-data').set(bearer(teacher)).expect(403);
    const cleared = await http.delete('/api/v1/test-data').set(bearer(admin)).expect(200);
    expect(cleared.body).toEqual({ classes: 0, children: 0, staff: 0 });
  });
});
