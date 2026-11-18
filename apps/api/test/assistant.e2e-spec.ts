import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AssistantPlan, AssistantResult, AuthResponse } from '@latif/shared';
import { AiPlanner } from '../src/modules/assistant/ai-planner';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.PUBLIC_DEMO = 'false';
let googleToken: (email: string, sub: string) => string;

/** Smart assistant: text / CSV → preview (nothing saved) → confirm → saved per branch. */
describe('Smart assistant (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const u = Date.now();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  let branchA: string, branchB: string, adminA: string, managerA: string, teacherA: string;
  const nameA = `فرع الاختبار أ ${u}`;
  const nameB = `فرع الاختبار ب ${u}`;

  const plan = async (token: string, body: object) =>
    (await http.post('/api/v1/assistant/plan').set(bearer(token)).send(body).expect(200))
      .body as AssistantPlan;
  const apply = async (token: string, operations: unknown[]) =>
    (await http.post('/api/v1/assistant/apply').set(bearer(token)).send({ operations }).expect(200))
      .body as AssistantResult[];

  beforeAll(async () => {
    const f = await import('./app.factory');
    googleToken = f.googleToken;
    app = await f.createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    branchA = (await prisma.raw.daycare.create({ data: { name: nameA, slug: `as-a-${u}` } })).id;
    branchB = (await prisma.raw.daycare.create({ data: { name: nameB, slug: `as-b-${u}` } })).id;
    const boss = (
      await http
        .post('/api/v1/auth/google')
        .send({ idToken: googleToken('boss@latif.test', 'g-boss') })
        .expect(200)
    ).body as AuthResponse;
    adminA = (
      await http
        .post('/api/v1/auth/switch-daycare')
        .set(bearer(boss.tokens.accessToken))
        .send({ daycareId: branchA })
        .expect(200)
    ).body.tokens.accessToken;
    const login = async (role: string, email: string) => {
      const r = (
        await http
          .post('/api/v1/users')
          .set(bearer(adminA))
          .send({ role, fullName: 'شخص اختبار', email })
          .expect(201)
      ).body;
      return (
        await http
          .post('/api/v1/auth/login')
          .send({ identifier: email, password: r.issued.tempPassword })
          .expect(200)
      ).body.tokens.accessToken as string;
    };
    managerA = await login('MANAGER', `as-m${u}@example.com`);
    teacherA = await login('STAFF', `as-t${u}@example.com`);
  });
  afterAll(() => app.close());

  it('teachers and parents cannot use the assistant', async () => {
    await http
      .post('/api/v1/assistant/plan')
      .set(bearer(teacherA))
      .send({ message: 'x' })
      .expect(403);
  });

  it('a CSV becomes a preview (nothing saved), then is applied to the branch', async () => {
    const csv = [
      'اسم الطفل,الجنس,تاريخ الميلاد,الفصل,ولي الأمر,جوال ولي الأمر,صلة القرابة',
      `ليان ${u},أنثى,2022-01-10,العصافير,أم ليان,05${String(u).slice(-8)},أم`,
      `سعد ${u},ذكر,,العصافير,أبو سعد,0501112224,أب`,
    ].join('\n');
    const p = await plan(managerA, { message: '', file: { name: 'kids.csv', text: csv } });
    expect(p.source).toBe('table');
    // The missing class is proposed first so the child can land in it.
    expect(p.operations.map((o) => o.type)).toEqual(['class.create', 'child.create']);
    expect(p.warnings).toEqual(
      expect.arrayContaining(['class_added: العصافير', 'row 3: missing_birth_date']),
    );
    expect(await prisma.raw.child.count({ where: { daycareId: branchA } })).toBe(0);

    const r = await apply(managerA, p.operations);
    expect(r.map((x) => x.status)).toEqual(['done', 'done']);
    const kid = await prisma.raw.child.findFirstOrThrow({
      where: { daycareId: branchA, fullName: `ليان ${u}` },
      include: { classroom: true, guardians: true },
    });
    expect(kid.classroom?.name).toBe('العصافير');
    expect(kid.guardians[0]).toMatchObject({ fullName: 'أم ليان', relationship: 'أم' });
    // Applying the same file again does not duplicate anything.
    expect((await apply(managerA, p.operations)).map((x) => x.status)).toEqual([
      'skipped',
      'skipped',
    ]);
  });

  it('pasted rows create teachers and parents with one-time passwords', async () => {
    const p = await plan(managerA, {
      message: `name\temail\trole\tclass\nمعلمة ${u}\tas-t2${u}@example.com\tمعلمة\tالعصافير\nولي ${u}\tas-p${u}@example.com\tولي أمر\t`,
    });
    expect(p.operations).toHaveLength(2);
    const r = await apply(managerA, p.operations);
    expect(r.every((x) => x.status === 'done' && x.issued?.tempPassword)).toBe(true);
    const t = await prisma.raw.membership.findFirstOrThrow({
      where: { daycareId: branchA, user: { email: `as-t2${u}@example.com` } },
      include: { classLinks: { include: { classroom: true } } },
    });
    expect(t.role).toBe('STAFF');
    expect(t.classLinks.map((c) => c.classroom.name)).toEqual(['العصافير']);
  });

  it('a branch manager cannot reach another branch or create a manager through the assistant', async () => {
    const p = await plan(managerA, {
      message: `name,email,role,branch\nX ${u},as-x${u}@example.com,teacher,${nameB}`,
    });
    expect(p.operations).toHaveLength(0);
    expect(p.warnings[0]).toMatch(/^branch_not_allowed/);
    const r = await apply(managerA, [
      { type: 'user.create', role: 'MANAGER', fullName: 'Y', email: `as-y${u}@example.com` },
      { type: 'class.create', branch: nameB, name: 'B', capacity: 5 },
    ]);
    expect(r.map((x) => [x.status, x.detail])).toEqual([
      ['failed', 'forbidden_manager'],
      ['failed', 'other_branch'],
    ]);
    expect(await prisma.raw.classroom.count({ where: { daycareId: branchB } })).toBe(0);
  });

  it('the general admin can fill several branches from one sheet', async () => {
    const p = await plan(adminA, {
      message: `type,name,capacity,price,branch\nclass,الفراشات,12,,${nameB}\nplan,شهري,,1200,${nameB}`,
    });
    const r = await apply(adminA, p.operations);
    expect(r.map((x) => x.status)).toEqual(['done', 'done']);
    expect(
      await prisma.raw.classroom.count({ where: { daycareId: branchB, name: 'الفراشات' } }),
    ).toBe(1);
    expect(await prisma.raw.plan.count({ where: { daycareId: branchB, name: 'شهري' } })).toBe(1);
    // Branch settings + module switch, by name, and every apply is audited.
    await apply(adminA, [
      { type: 'branch.update', city: 'الرياض' },
      { type: 'feature.set', key: 'units', enabled: false },
    ]);
    expect((await prisma.raw.daycare.findUniqueOrThrow({ where: { id: branchA } })).city).toBe(
      'الرياض',
    );
    expect(
      await prisma.raw.auditLog.count({ where: { action: 'assistant.apply', daycareId: branchA } }),
    ).toBeGreaterThan(0);
  });

  it('free text without an AI key explains how to proceed; with AI, Claude output is validated', async () => {
    const off = await plan(managerA, { message: 'أضف معلمة اسمها سارة' });
    expect(off).toMatchObject({ source: 'none', operations: [], warnings: ['ai_not_configured'] });

    // Stand-in for the Claude API response (no network): one valid and one invalid item.
    const planner = app.get(AiPlanner);
    jest.spyOn(planner, 'enabled', 'get').mockReturnValue(true);
    const create = jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            reply: 'سأضيف المعلمة سارة.',
            operations: [
              {
                type: 'user.create',
                branch: null,
                role: 'STAFF',
                fullName: 'سارة',
                email: 'sara@example.com',
                phone: null,
                classNames: [],
              },
              { type: 'child.create', fullName: 'بلا تاريخ' },
            ],
          }),
        },
      ],
    });
    (planner as unknown as { client: unknown }).client = { beta: { messages: { create } } };
    const on = await plan(managerA, { message: 'أضف معلمة اسمها سارة sara@example.com' });
    expect(on.source).toBe('ai');
    expect(on.reply).toBe('سأضيف المعلمة سارة.');
    expect(on.operations).toEqual([
      expect.objectContaining({ type: 'user.create', fullName: 'سارة' }),
    ]);
    expect(on.warnings).toEqual(['invalid_items: 1']);
    const req = create.mock.calls[0]![0] as {
      output_config: { format: { type: string } };
      messages: { content: string }[];
    };
    expect(req.output_config.format.type).toBe('json_schema');
    expect(req.messages.at(-1)!.content).toContain(nameA);
  });
});
