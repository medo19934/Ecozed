import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import {
  ChildSchema,
  PlanSchema,
  UpdateBranchSchema,
  type AssistantOp,
  type AssistantPlan,
  type AssistantPlanRequest,
  type AssistantResult,
  type IssuedPassword,
} from '@latif/shared';
import { ZodError } from 'zod';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { RequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchesService } from '../branches/branches.service';
import { ChildrenService } from '../children/children.service';
import { ClassesService } from '../classes/classes.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { looksTabular, readTable } from './table-parser';
import { readText } from './text-commands';

const norm = (s: string) =>
  s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();

/** Classes / settings before people, people before moves and deactivations. */
const ORDER: AssistantOp['type'][] = [
  'branch.update',
  'feature.set',
  'class.create',
  'plan.create',
  'user.create',
  'child.create',
  'user.update',
  'child.move',
  'user.deactivate',
];

class Skip extends Error {}

/**
 * Smart assistant: chat text or a CSV → proposed operations → (after confirmation) applied
 * through the regular services, as the signed-in admin. Nothing is saved at the "plan" step.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branches: BranchesService,
    private readonly classes: ClassesService,
    private readonly children: ChildrenService,
    private readonly subscriptions: SubscriptionsService,
    private readonly users: UsersService,
  ) {}

  /** Branches this admin may change (general admin: all; manager: own). */
  private async allowedBranches(auth: AuthContext) {
    return this.prisma.raw.daycare.findMany({
      where: { deletedAt: null, ...(auth.isSuperAdmin ? {} : { id: auth.daycareId ?? '-' }) },
      select: { id: true, name: true, nameEn: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Branch named in an operation → id (empty = active branch). Null when not allowed / unknown. */
  private resolveBranch(
    auth: AuthContext,
    list: { id: string; name: string; nameEn: string | null }[],
    branch: string | undefined,
  ): string | null {
    if (!branch?.trim()) return auth.daycareId;
    const n = norm(branch);
    const hit =
      list.find((b) => norm(b.name) === n || (b.nameEn && norm(b.nameEn) === n)) ??
      list.find(
        (b) =>
          norm(b.name).includes(n) ||
          n.includes(norm(b.name)) ||
          (b.nameEn && (norm(b.nameEn).includes(n) || n.includes(norm(b.nameEn)))),
      );
    return hit?.id ?? null;
  }

  private classNamesIn(daycareId: string) {
    return this.prisma.raw.classroom
      .findMany({ where: { daycareId, deletedAt: null }, select: { name: true } })
      .then((r) => r.map((c) => c.name));
  }

  /** Reads a CSV / pasted table / chat message (free, rule-based — no paid AI). Saves nothing. */
  async plan(auth: AuthContext, req: AssistantPlanRequest): Promise<AssistantPlan> {
    const list = await this.allowedBranches(auth);
    const tableText = req.file?.text ?? (looksTabular(req.message) ? req.message : null);
    let operations: AssistantOp[] = [];
    let warnings: string[] = [];
    const reply = '';
    let source: AssistantPlan['source'] = 'none';

    if (tableText) {
      const read = readTable(tableText);
      operations = read.operations;
      warnings = read.warnings;
      source = 'table';
      // A note typed next to a file (e.g. "all of these go to Al Rayan") is not interpreted.
      if (req.message.trim() && req.file) warnings.push('note_not_read');
    } else if (req.message.trim()) {
      const read = readText(req.message);
      operations = read.operations;
      warnings = read.warnings;
      source = 'text';
    }

    // Branch check + missing classes (added as class.create so the rows can land in them).
    const kept: AssistantOp[] = [];
    const known = new Map<string, Set<string>>();
    const classAdds: AssistantOp[] = [];
    for (const op of operations) {
      const daycareId = this.resolveBranch(auth, list, op.branch);
      if (!daycareId) {
        warnings.push(`branch_not_allowed: ${op.branch ?? ''}`);
        continue;
      }
      kept.push(op);
      if (!known.has(daycareId)) {
        known.set(daycareId, new Set((await this.classNamesIn(daycareId)).map(norm)));
      }
      const names = known.get(daycareId)!;
      if (op.type === 'class.create') names.add(norm(op.name));
      const wanted =
        op.type === 'child.create' || op.type === 'child.move'
          ? [op.className]
          : op.type === 'user.create' || op.type === 'user.update'
            ? (op.classNames ?? [])
            : [];
      for (const w of wanted) {
        if (w && !names.has(norm(w)) && !names.has(norm(`${w} class`))) {
          names.add(norm(w));
          classAdds.push({ type: 'class.create', branch: op.branch, name: w, capacity: 20 });
          warnings.push(`class_added: ${w}`);
        }
      }
    }
    return { reply, source, operations: [...classAdds, ...kept], warnings };
  }

  async apply(auth: AuthContext, operations: AssistantOp[]): Promise<AssistantResult[]> {
    const list = await this.allowedBranches(auth);
    const order = operations
      .map((op, index) => ({ op, index }))
      .sort((a, b) => ORDER.indexOf(a.op.type) - ORDER.indexOf(b.op.type));
    const results: AssistantResult[] = [];
    for (const { op, index } of order) {
      const daycareId = this.resolveBranch(auth, list, op.branch);
      if (!daycareId) {
        results.push({ index, status: 'failed', detail: 'other_branch', issued: null });
        continue;
      }
      if (!auth.isSuperAdmin && daycareId !== auth.daycareId) {
        throw new ForbiddenException({ code: 'other_branch' });
      }
      const scoped: AuthContext = { ...auth, daycareId };
      const store = { ...(RequestContext.get() ?? { requestId: 'assistant' }), daycareId };
      try {
        const out = await RequestContext.run(store, () => this.applyOne(scoped, daycareId, op));
        results.push({ index, status: 'done', detail: out.detail, issued: out.issued });
      } catch (e) {
        results.push({ index, ...this.failure(e), issued: null });
      }
    }
    results.sort((a, b) => a.index - b.index);
    await this.audit.log({
      action: 'assistant.apply',
      entity: 'Assistant',
      metadata: {
        done: results.filter((r) => r.status === 'done').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        failed: results.filter((r) => r.status === 'failed').length,
        types: [...new Set(operations.map((o) => o.type))],
      },
    });
    return results;
  }

  private failure(e: unknown): { status: 'skipped' | 'failed'; detail: string } {
    if (e instanceof Skip) return { status: 'skipped', detail: e.message };
    if (e instanceof ZodError)
      return { status: 'failed', detail: e.issues[0]?.message ?? 'validation_error' };
    if (e instanceof HttpException) {
      const body = e.getResponse() as { code?: string; message?: unknown } | string;
      const code = typeof body === 'object' && body.code ? body.code : null;
      if (code === 'user_exists' || code === 'staff_exists')
        return { status: 'skipped', detail: 'exists' };
      return { status: 'failed', detail: code ?? (e.getStatus() === 403 ? 'forbidden' : 'error') };
    }
    return { status: 'failed', detail: 'error' };
  }

  private async classId(daycareId: string, name: string | undefined) {
    if (!name?.trim()) return null;
    const rows = await this.prisma.raw.classroom.findMany({
      where: { daycareId, deletedAt: null },
      select: { id: true, name: true },
    });
    const hit =
      rows.find((c) => norm(c.name) === norm(name)) ??
      rows.find((c) => norm(c.name) === norm(`${name} class`));
    if (!hit) throw new Skip(`unknown_class: ${name}`);
    return hit.id;
  }

  private async findMember(daycareId: string, match: string) {
    const m = match.trim();
    const rows = await this.prisma.raw.membership.findMany({
      where: {
        daycareId,
        deletedAt: null,
        role: { in: ['MANAGER', 'STAFF', 'PARENT'] },
        user: {
          OR: [
            { email: m.toLowerCase() },
            { phone: m.startsWith('05') ? `+966${m.slice(1)}` : m },
            { fullName: { equals: m, mode: 'insensitive' } },
          ],
        },
      },
      select: { id: true },
    });
    if (rows.length === 0) throw new Skip(`not_found: ${m}`);
    if (rows.length > 1) throw new Skip(`ambiguous: ${m}`);
    return rows[0]!.id;
  }

  private async applyOne(
    auth: AuthContext,
    daycareId: string,
    op: AssistantOp,
  ): Promise<{ detail: string | null; issued: IssuedPassword | null }> {
    switch (op.type) {
      case 'class.create': {
        const exists = await this.prisma.raw.classroom.findFirst({
          where: { daycareId, deletedAt: null, name: { equals: op.name, mode: 'insensitive' } },
        });
        if (exists) throw new Skip('exists');
        await this.classes.create({
          name: op.name,
          capacity: op.capacity,
          minAgeMonths: op.minAgeMonths ?? null,
          maxAgeMonths: op.maxAgeMonths ?? null,
          teacherIds: [],
        });
        return { detail: null, issued: null };
      }
      case 'user.create': {
        const classIds = [];
        for (const n of op.role === 'STAFF' ? op.classNames : [])
          classIds.push(await this.classId(daycareId, n));
        const r = await this.users.create(auth, {
          role: op.role,
          fullName: op.fullName,
          email: op.email || undefined,
          phone: op.phone || undefined,
          daycareId,
          classIds: classIds.filter((x): x is string => Boolean(x)),
          children: [],
        });
        return { detail: null, issued: r.issued };
      }
      case 'user.update': {
        const id = await this.findMember(daycareId, op.match);
        let classIds: string[] | undefined;
        if (op.classNames) {
          classIds = [];
          for (const n of op.classNames) {
            const c = await this.classId(daycareId, n);
            if (c) classIds.push(c);
          }
        }
        await this.users.update(auth, id, {
          ...(op.fullName ? { fullName: op.fullName } : {}),
          ...(op.phone ? { phone: op.phone } : {}),
          ...(op.role ? { role: op.role } : {}),
          ...(classIds ? { classIds } : {}),
        });
        return { detail: null, issued: null };
      }
      case 'user.deactivate': {
        const id = await this.findMember(daycareId, op.match);
        await this.users.setActive(auth, id, false);
        return { detail: null, issued: null };
      }
      case 'child.create': {
        const exists = await this.prisma.raw.child.findFirst({
          where: {
            daycareId,
            deletedAt: null,
            fullName: { equals: op.fullName, mode: 'insensitive' },
            birthDate: new Date(`${op.birthDate}T00:00:00Z`),
          },
        });
        if (exists) throw new Skip('exists');
        const input = ChildSchema.parse({
          fullName: op.fullName,
          gender: op.gender,
          birthDate: op.birthDate,
          classroomId: await this.classId(daycareId, op.className),
          medicalNotes: op.medicalNotes ?? null,
          guardians: [
            {
              fullName: op.guardianName,
              relationship: op.guardianRelationship,
              phone: op.guardianPhone ?? null,
              email: op.guardianEmail ?? null,
              isPrimary: true,
            },
          ],
        });
        await this.children.create(input);
        return { detail: null, issued: null };
      }
      case 'child.move': {
        const kids = await this.prisma.raw.child.findMany({
          where: {
            daycareId,
            deletedAt: null,
            fullName: { equals: op.childName, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (kids.length === 0) throw new Skip(`not_found: ${op.childName}`);
        if (kids.length > 1) throw new Skip(`ambiguous: ${op.childName}`);
        const classroomId = await this.classId(daycareId, op.className);
        await this.users.moveChild(auth, kids[0]!.id, { classroomId: classroomId ?? undefined });
        return { detail: null, issued: null };
      }
      case 'branch.update': {
        const current = await this.branches.current();
        const input = UpdateBranchSchema.parse({
          name: op.name ?? current.name,
          nameEn: op.nameEn ?? current.nameEn,
          phone: op.phone ?? current.phone,
          email: op.email ?? current.email,
          city: op.city ?? current.city,
          address: op.address ?? current.address,
          latitude: current.latitude,
          longitude: current.longitude,
          geofenceRadiusM: current.geofenceRadiusM,
          useHijri: current.useHijri,
        });
        await this.branches.update(input);
        return { detail: null, issued: null };
      }
      case 'feature.set':
        await this.branches.updateFeatures({ features: [{ key: op.key, enabled: op.enabled }] });
        return { detail: null, issued: null };
      case 'plan.create': {
        const exists = await this.prisma.raw.plan.findFirst({
          where: { daycareId, deletedAt: null, name: { equals: op.name, mode: 'insensitive' } },
        });
        if (exists) throw new Skip('exists');
        await this.subscriptions.createPlan(
          PlanSchema.parse({ name: op.name, price: op.price, period: op.period }),
        );
        return { detail: null, issued: null };
      }
    }
  }
}
