import { Role } from '@latif/shared';

export type AppArea = 'parent' | 'teacher';

/** Which app area a role lands in (single Expo app, two experiences). */
export const areaForRole = (role: Role | null | undefined): AppArea | null => {
  if (role === Role.PARENT) return 'parent';
  if (role === Role.STAFF || role === Role.OWNER || role === Role.MANAGER) return 'teacher';
  return null;
};

export const homeRouteFor = (role: Role | null | undefined) => {
  const area = areaForRole(role);
  return area === 'parent' ? '/(parent)' : area === 'teacher' ? '/(teacher)' : '/(auth)/login';
};
