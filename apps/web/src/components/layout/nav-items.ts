import { menuFor, type AuthUser, type MenuKey, type StaffPermission } from '@latif/shared';
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

/** Icons per shared menu key (the role rules themselves live in @latif/shared `menuFor`). */
const ICONS: Record<MenuKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  home: House,
  attendance: ClipboardCheck,
  children: Baby,
  parents: Contact,
  staff: Users,
  classes: School,
  units: BookOpen,
  calendar: CalendarDays,
  admissions: UserPlus,
  subscriptions: CreditCard,
  messages: MessageSquare,
  dailyReports: NotebookPen,
  reports: BarChart3,
  settings: Settings,
  enrollChild: UserPlus,
};

export const navFor = (user: AuthUser | undefined): NavItem[] =>
  menuFor(user).map((m) => ({
    key: m.key,
    href: m.path,
    icon: ICONS[m.key],
    unreadDot: m.key === 'messages',
  }));

/** True when the current role may open this path (the user's menu is the allow-list). */
export const canOpen = (user: AuthUser | undefined, pathname: string): boolean =>
  navFor(user).some((i) => !i.soon && (pathname === i.href || pathname.startsWith(`${i.href}/`)));
