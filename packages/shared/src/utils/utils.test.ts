import { describe, expect, it } from 'vitest';
import { ageParts, paginate } from './index';
import { LoginSchema, RegisterSchema } from '../schemas';

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
  it('accepts email or phone identifiers', () => {
    expect(LoginSchema.safeParse({ identifier: 'A@B.co', password: 'x' }).success).toBe(true);
    expect(LoginSchema.safeParse({ identifier: '+966501234567', password: 'x' }).success).toBe(
      true,
    );
    expect(LoginSchema.safeParse({ identifier: 'nope', password: 'x' }).success).toBe(false);
  });
  it('defaults register locale to ar', () => {
    const r = RegisterSchema.parse({
      fullName: 'Sara',
      email: 'sara@example.com',
      phone: '+966501234567',
      password: 'secret123',
      daycareName: 'Little Stars',
    });
    expect(r.locale).toBe('ar');
  });
});
