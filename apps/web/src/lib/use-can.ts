'use client';

import type { AuthUser, StaffPermission } from '@latif/shared';
import { useSession } from './use-session';

export const isBranchAdmin = (u: AuthUser | undefined) =>
  u?.role === 'SUPER_ADMIN' || u?.role === 'MANAGER';

/** UI hint only — the API enforces every permission. */
export function useCan(permission?: StaffPermission): boolean {
  const { data: user } = useSession();
  if (!user) return false;
  if (!permission) return isBranchAdmin(user);
  return user.permissions.includes(permission);
}
