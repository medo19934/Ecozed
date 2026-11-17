import { ALL_STAFF_PERMISSIONS, StaffPermission } from '@latif/shared';
import { effectivePermissions, hasPermissions } from './permissions';

describe('permissions', () => {
  it('owner and manager hold every permission', () => {
    expect(effectivePermissions('OWNER', [])).toEqual(ALL_STAFF_PERMISSIONS);
    expect(effectivePermissions('MANAGER', [])).toEqual(ALL_STAFF_PERMISSIONS);
  });
  it('staff only hold granted, known flags', () => {
    expect(effectivePermissions('STAFF', ['canAddChild', 'bogus'])).toEqual(['canAddChild']);
  });
  it('parents hold none', () => {
    expect(effectivePermissions('PARENT', ['canAddChild'])).toEqual([]);
  });
  it('hasPermissions requires all', () => {
    const held = [StaffPermission.CAN_ADD_CHILD];
    expect(hasPermissions(held, [StaffPermission.CAN_ADD_CHILD])).toBe(true);
    expect(
      hasPermissions(held, [StaffPermission.CAN_ADD_CHILD, StaffPermission.CAN_ADD_STAFF]),
    ).toBe(false);
  });
});
