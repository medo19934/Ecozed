import { areaForRole, homeRouteFor } from './roles';

describe('role routing', () => {
  it('maps parents and staff to their areas', () => {
    expect(areaForRole('PARENT')).toBe('parent');
    expect(areaForRole('STAFF')).toBe('teacher');
    expect(areaForRole('OWNER')).toBe('teacher');
    expect(areaForRole(null)).toBeNull();
  });
  it('falls back to login for unknown roles', () => {
    expect(homeRouteFor('SUPER_ADMIN')).toBe('/(auth)/login');
    expect(homeRouteFor('PARENT')).toBe('/(parent)');
  });
});
