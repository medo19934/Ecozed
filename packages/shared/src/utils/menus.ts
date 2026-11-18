import type { AuthUser } from '../types';
import { FEATURE_DEFAULTS, type FeatureToggle, type StaffPermission } from '../enums';

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
  | 'assistant'
  | 'enrollChild';

export interface MenuEntry {
  key: MenuKey;
  /** Web path (without locale). */
  path: string;
  permission?: StaffPermission;
  roles?: AuthUser['role'][];
  /** Branch module switch (Settings > Modules): hidden when switched off. */
  feature?: FeatureToggle;
}

export const STAFF_MENU: MenuEntry[] = [
  { key: 'dashboard', path: '/dashboard' },
  { key: 'attendance', path: '/attendance' },
  { key: 'children', path: '/children' },
  { key: 'parents', path: '/parents', roles: ['SUPER_ADMIN', 'MANAGER'] },
  { key: 'staff', path: '/staff', permission: 'canAddStaff' },
  { key: 'classes', path: '/classes' },
  { key: 'units', path: '/units', feature: 'units' },
  { key: 'calendar', path: '/calendar', feature: 'calendar' },
  { key: 'admissions', path: '/admissions', permission: 'canManageEnrollment' },
  {
    key: 'subscriptions',
    path: '/subscriptions',
    permission: 'canManagePayments',
    feature: 'subscriptions',
  },
  { key: 'messages', path: '/messages', feature: 'messages' },
  { key: 'dailyReports', path: '/daily-reports', feature: 'dailyReports' },
  { key: 'reports', path: '/reports', permission: 'canViewReports' },
  { key: 'settings', path: '/settings', permission: 'canManageSettings' },
  { key: 'assistant', path: '/assistant', roles: ['SUPER_ADMIN', 'MANAGER'] },
];

export const PARENT_MENU: MenuEntry[] = [
  { key: 'home', path: '/dashboard' },
  { key: 'enrollChild', path: '/enroll' },
  { key: 'calendar', path: '/calendar', feature: 'calendar' },
  { key: 'messages', path: '/messages', feature: 'messages' },
  { key: 'dailyReports', path: '/daily-reports', feature: 'dailyReports' },
  { key: 'subscriptions', path: '/subscriptions', feature: 'subscriptions' },
];

/** The menu a user may see (also the allow-list for opening pages). */
type MenuUser = Pick<AuthUser, 'role' | 'permissions'> & Partial<Pick<AuthUser, 'features'>>;

/** Is a branch module on for this user's active branch (missing = default)? */
export const moduleOn = (user: MenuUser, feature: FeatureToggle) =>
  user.features?.[feature] ?? FEATURE_DEFAULTS[feature];

export const menuFor = (user: MenuUser | null | undefined): MenuEntry[] => {
  if (!user) return [];
  const on = (i: MenuEntry) => !i.feature || moduleOn(user, i.feature);
  if (user.role === 'PARENT') return PARENT_MENU.filter(on);
  return STAFF_MENU.filter(
    (i) =>
      on(i) &&
      (!i.permission || user.permissions.includes(i.permission)) &&
      (!i.roles || i.roles.includes(user.role)),
  );
};

export const canOpenPath = (user: MenuUser | null | undefined, path: string) =>
  menuFor(user).some((i) => path === i.path || path.startsWith(`${i.path}/`));
