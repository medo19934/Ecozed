import type { AuthUser } from '../types';
import type { StaffPermission } from '../enums';

/**
 * One role → menu definition for web and mobile (same order, same rules).
 * The API and Row Level Security enforce access; menus only decide what is shown.
 */
export type MenuKey =
  | 'dashboard'
  | 'home'
  | 'attendance'
  | 'children'
  | 'parents'
  | 'staff'
  | 'classes'
  | 'units'
  | 'calendar'
  | 'admissions'
  | 'subscriptions'
  | 'messages'
  | 'dailyReports'
  | 'reports'
  | 'settings'
  | 'enrollChild';

export interface MenuEntry {
  key: MenuKey;
  /** Web path (without locale). */
  path: string;
  permission?: StaffPermission;
  roles?: AuthUser['role'][];
}

export const STAFF_MENU: MenuEntry[] = [
  { key: 'dashboard', path: '/dashboard' },
  { key: 'attendance', path: '/attendance' },
  { key: 'children', path: '/children' },
  { key: 'parents', path: '/parents', roles: ['SUPER_ADMIN', 'MANAGER'] },
  { key: 'staff', path: '/staff', permission: 'canAddStaff' },
  { key: 'classes', path: '/classes' },
  { key: 'units', path: '/units' },
  { key: 'calendar', path: '/calendar' },
  { key: 'admissions', path: '/admissions', permission: 'canManageEnrollment' },
  { key: 'subscriptions', path: '/subscriptions', permission: 'canManagePayments' },
  { key: 'messages', path: '/messages' },
  { key: 'dailyReports', path: '/daily-reports' },
  { key: 'reports', path: '/reports', permission: 'canViewReports' },
  { key: 'settings', path: '/settings', permission: 'canManageSettings' },
];

export const PARENT_MENU: MenuEntry[] = [
  { key: 'home', path: '/dashboard' },
  { key: 'enrollChild', path: '/enroll' },
  { key: 'calendar', path: '/calendar' },
  { key: 'messages', path: '/messages' },
  { key: 'dailyReports', path: '/daily-reports' },
  { key: 'subscriptions', path: '/subscriptions' },
];

/** The menu a user may see (also the allow-list for opening pages). */
export const menuFor = (
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
): MenuEntry[] => {
  if (!user) return [];
  if (user.role === 'PARENT') return PARENT_MENU;
  return STAFF_MENU.filter(
    (i) =>
      (!i.permission || user.permissions.includes(i.permission)) &&
      (!i.roles || i.roles.includes(user.role)),
  );
};

export const canOpenPath = (
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
  path: string,
) => menuFor(user).some((i) => path === i.path || path.startsWith(`${i.path}/`));
