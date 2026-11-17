import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';

/**
 * Models whose rows belong to a single daycare. The scoped client injects
 * `daycareId` from the request context into every query on these models.
 * Keep in sync with schema.prisma (enforced by tenancy.spec.ts).
 */
export const TENANT_MODELS = new Set<string>([
  'Membership',
  'DaycareFeature',
  'AuditLog',
  'Classroom',
  'ClassTeacher',
  'Child',
  'ChildGuardian',
  'Document',
]);

/** Models that carry `daycareId` but are intentionally NOT auto-scoped. */
export const TENANT_EXEMPT_MODELS = new Set<string>(['RefreshToken']);

/** Models with `deletedAt` (soft delete). */
export const SOFT_DELETE_MODELS = new Set<string>([
  'User',
  'Daycare',
  'Membership',
  'Classroom',
  'Child',
  'Document',
]);

const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);
const WHERE_WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

export const requireTenantId = (): string => {
  const id = RequestContext.daycareId();
  if (!id) throw new ForbiddenException('No active daycare for this request');
  return id;
};

type Args = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
};

/** Pure function: returns args with tenant + soft-delete constraints applied. */
export function applyScope(model: string, operation: string, args: Args, daycareId: string): Args {
  const next: Args = { ...args };
  const isTenant = TENANT_MODELS.has(model);
  const isSoft = SOFT_DELETE_MODELS.has(model);

  if (READ_OPS.has(operation) || WHERE_WRITE_OPS.has(operation)) {
    const where: Record<string, unknown> = { ...(next.where ?? {}) };
    if (isTenant) where.daycareId = daycareId;
    if (isSoft && READ_OPS.has(operation) && !('deletedAt' in where)) where.deletedAt = null;
    next.where = where;
  }

  if (isTenant) {
    if (operation === 'create') {
      next.data = { ...(next.data as Record<string, unknown>), daycareId };
    } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
      const data = next.data as Record<string, unknown> | Record<string, unknown>[];
      next.data = Array.isArray(data)
        ? data.map((d) => ({ ...d, daycareId }))
        : { ...data, daycareId };
    } else if (operation === 'upsert') {
      next.create = { ...(next.create ?? {}), daycareId };
    }
    // Prevent moving rows to another tenant.
    if (
      (operation === 'update' || operation === 'updateMany' || operation === 'upsert') &&
      next.data
    ) {
      const data = { ...(next.data as Record<string, unknown>) };
      delete data.daycareId;
      delete data.daycare;
      next.data = data;
    }
  }
  return next;
}
