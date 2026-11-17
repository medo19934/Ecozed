import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  School,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key:
    | 'dashboard'
    | 'classes'
    | 'profile'
    | 'people'
    | 'curriculum'
    | 'calendar'
    | 'attendance'
    | 'enrollment'
    | 'subscriptions'
    | 'reports'
    | 'documents'
    | 'messages'
    | 'settings';
  href: string;
  icon: LucideIcon;
  /** Not built yet — rendered disabled with a "Soon" badge. Flip off as phases land. */
  soon?: boolean;
  unreadDot?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'classes', href: '/classes', icon: School, soon: true },
  { key: 'profile', href: '/settings/profile', icon: Building2, soon: true },
  { key: 'people', href: '/children', icon: Users, soon: true },
  { key: 'curriculum', href: '/curriculum', icon: BookOpen, soon: true },
  { key: 'calendar', href: '/calendar', icon: CalendarDays, soon: true },
  { key: 'attendance', href: '/attendance', icon: ClipboardCheck, soon: true },
  { key: 'enrollment', href: '/enrollment', icon: UserPlus, soon: true },
  { key: 'subscriptions', href: '/subscriptions', icon: CreditCard, soon: true },
  { key: 'reports', href: '/reports', icon: BarChart3, soon: true },
  { key: 'documents', href: '/documents', icon: FileText, soon: true },
  { key: 'messages', href: '/messages', icon: MessageSquare, soon: true, unreadDot: true },
  { key: 'settings', href: '/settings', icon: Settings, soon: true },
];
