import { areaForRole, homeRouteFor } from './roles';

describe('role routing', () => {
  it('maps parents and staff roles to their areas', () => {
    expect(areaForRole('PARENT')).toBe('parent');
    expect(areaForRole('STAFF')).toBe('teacher');
    expect(areaForRole('MANAGER')).toBe('teacher');
    expect(areaForRole('SUPER_ADMIN')).toBe('teacher');
    expect(areaForRole(null)).toBeNull();
  });
  it('falls back to login without a role', () => {
    expect(homeRouteFor(undefined)).toBe('/(auth)/login');
    expect(homeRouteFor('PARENT')).toBe('/(parent)');
  });
});
