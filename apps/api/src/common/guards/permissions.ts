import { ALL_STAFF_PERMISSIONS, Role, type StaffPermission } from '@latif/shared';

/** Effective permission set for a membership. */
export const effectivePermissions = (role: Role | null, granted: string[]): StaffPermission[] => {
  if (role === Role.MANAGER || role === Role.SUPER_ADMIN) {
    return [...ALL_STAFF_PERMISSIONS];
  }
  if (role === Role.STAFF) {
    return granted.filter((p): p is StaffPermission =>
      (ALL_STAFF_PERMISSIONS as string[]).includes(p),
    );
  }
  return [];
};

export const hasPermissions = (held: StaffPermission[], required: StaffPermission[]): boolean =>
  required.every((p) => held.includes(p));
