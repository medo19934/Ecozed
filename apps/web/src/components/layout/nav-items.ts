import type { AuthUser, StaffPermission } from '@latif/shared';
import {
  BarChart3,
  Baby,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Contact,
  CreditCard,
  House,
  LayoutDashboard,
  MessageSquare,
  NotebookPen,
  School,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavKey =
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

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** Not built yet — rendered disabled with a "Soon" badge. Flip off as phases land. */
  soon?: boolean;
  unreadDot?: boolean;
  /** Hidden unless the user holds this permission (API enforces it anyway). */
  permission?: StaffPermission;
  /** Only these roles see it (default: everyone using this menu). */
  roles?: AuthUser['role'][];
}

const STAFF_NAV: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'attendance', href: '/attendance', icon: ClipboardCheck },
  { key: 'children', href: '/children', icon: Baby },
  { key: 'parents', href: '/parents', icon: Contact, roles: ['SUPER_ADMIN', 'MANAGER'] },
  { key: 'staff', href: '/staff', icon: Users, permission: 'canAddStaff' },
  { key: 'classes', href: '/classes', icon: School },
  { key: 'units', href: '/units', icon: BookOpen },
  { key: 'calendar', href: '/calendar', icon: CalendarDays },
  { key: 'admissions', href: '/admissions', icon: UserPlus, permission: 'canManageEnrollment' },
  {
    key: 'subscriptions',
    href: '/subscriptions',
    icon: CreditCard,
    permission: 'canManagePayments',
  },
  { key: 'messages', href: '/messages', icon: MessageSquare, unreadDot: true },
  { key: 'dailyReports', href: '/daily-reports', icon: NotebookPen },
  { key: 'reports', href: '/reports', icon: BarChart3, permission: 'canViewReports' },
  { key: 'settings', href: '/settings', icon: Settings, permission: 'canManageSettings' },
];

const PARENT_NAV: NavItem[] = [
  { key: 'home', href: '/dashboard', icon: House },
  { key: 'enrollChild', href: '/enroll', icon: UserPlus },
  { key: 'calendar', href: '/calendar', icon: CalendarDays },
  { key: 'messages', href: '/messages', icon: MessageSquare, unreadDot: true },
  { key: 'dailyReports', href: '/daily-reports', icon: NotebookPen },
  { key: 'subscriptions', href: '/subscriptions', icon: CreditCard },
];

export const navFor = (user: AuthUser | undefined): NavItem[] =>
  user?.role === 'PARENT'
    ? PARENT_NAV
    : STAFF_NAV.filter(
        (i) =>
          (!i.permission || Boolean(user?.permissions.includes(i.permission))) &&
          (!i.roles || (user ? i.roles.includes(user.role) : false)),
      );

/** True when the current role may open this path (the user's menu is the allow-list). */
export const canOpen = (user: AuthUser | undefined, pathname: string): boolean =>
  navFor(user).some((i) => !i.soon && (pathname === i.href || pathname.startsWith(`${i.href}/`)));
