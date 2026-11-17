import { describe, expect, it } from 'vitest';
import { ageParts, paginate } from './index';
import { DevLoginSchema, GoogleAuthSchema } from '../schemas';

describe('utils', () => {
  it('computes age parts', () => {
    expect(ageParts(new Date(2020, 0, 15), new Date(2023, 5, 20))).toEqual({ years: 3, months: 5 });
    expect(ageParts(new Date(2020, 0, 25), new Date(2023, 5, 20))).toEqual({ years: 3, months: 4 });
  });
  it('paginates', () => {
    expect(paginate([1, 2], 41, 1, 20).totalPages).toBe(3);
  });
});

describe('auth schemas', () => {
  it('requires a Google id token', () => {
    expect(GoogleAuthSchema.safeParse({ idToken: 'x' }).success).toBe(false);
    expect(GoogleAuthSchema.safeParse({ idToken: 'a'.repeat(40) }).success).toBe(true);
  });
  it('normalises dev login email', () => {
    expect(DevLoginSchema.parse({ email: ' A@B.co ' }).email).toBe('a@b.co');
  });
});

import { localDate } from '../constants';
describe('localDate', () => {
  it('uses Riyadh time', () => {
    // 22:30 UTC on Jan 1 is 01:30 on Jan 2 in Riyadh (UTC+3)
    expect(localDate(new Date('2026-01-01T22:30:00Z'))).toBe('2026-01-02');
  });
});
