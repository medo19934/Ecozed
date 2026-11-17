import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOFT_DELETE_MODELS, TENANT_EXEMPT_MODELS, TENANT_MODELS, applyScope } from './tenancy';

const T = 'tenant-1';

describe('applyScope', () => {
  it('injects daycareId and deletedAt into reads', () => {
    expect(applyScope('Membership', 'findMany', { where: { role: 'STAFF' } }, T).where).toEqual({
      role: 'STAFF',
      daycareId: T,
      deletedAt: null,
    });
  });

  it('overrides a client-supplied daycareId', () => {
    expect(
      applyScope('Membership', 'findFirst', { where: { daycareId: 'evil' } }, T).where,
    ).toMatchObject({
      daycareId: T,
    });
  });

  it('respects explicit deletedAt filter (e.g. trash bin)', () => {
    const where = applyScope(
      'Membership',
      'findMany',
      { where: { deletedAt: { not: null } } },
      T,
    ).where;
    expect(where).toEqual({ deletedAt: { not: null }, daycareId: T });
  });

  it('sets daycareId on create / createMany', () => {
    expect(applyScope('DaycareFeature', 'create', { data: { key: 'x' } }, T).data).toEqual({
      key: 'x',
      daycareId: T,
    });
    expect(applyScope('DaycareFeature', 'createMany', { data: [{ key: 'a' }] }, T).data).toEqual([
      { key: 'a', daycareId: T },
    ]);
  });

  it('strips daycareId from update data', () => {
    const r = applyScope(
      'Membership',
      'update',
      { where: { id: '1' }, data: { daycareId: 'x', role: 'STAFF' } },
      T,
    );
    expect(r.data).toEqual({ role: 'STAFF' });
    expect(r.where).toEqual({ id: '1', daycareId: T });
  });

  it('leaves non-tenant models alone (except soft delete)', () => {
    expect(applyScope('OtpCode', 'findMany', { where: {} }, T).where).toEqual({});
    expect(applyScope('User', 'findMany', { where: {} }, T).where).toEqual({ deletedAt: null });
  });
});

describe('schema ↔ tenancy registry', () => {
  const schema = readFileSync(join(__dirname, '../../prisma/schema.prisma'), 'utf8');
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((m) => ({
    name: m[1]!,
    body: m[2]!,
  }));

  it('every model with daycareId is registered as tenant or exempt', () => {
    const missing = models
      .filter((m) => /^\s+daycareId\s/m.test(m.body))
      .filter((m) => !TENANT_MODELS.has(m.name) && !TENANT_EXEMPT_MODELS.has(m.name))
      .map((m) => m.name);
    expect(missing).toEqual([]);
  });

  it('every model with deletedAt is registered as soft delete', () => {
    const missing = models
      .filter((m) => /^\s+deletedAt\s/m.test(m.body))
      .filter((m) => !SOFT_DELETE_MODELS.has(m.name))
      .map((m) => m.name);
    expect(missing).toEqual([]);
  });
});
