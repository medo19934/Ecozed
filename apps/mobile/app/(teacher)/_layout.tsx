import {
  CalendarDays,
  ClipboardCheck,
  MessageCircle,
  NotebookPen,
  LayoutGrid,
  Sun,
  UserRound,
} from 'lucide-react-native';
import { AreaTabs } from '@/components/area-tabs';

export default function TeacherLayout() {
  return (
    <AreaTabs
      area="teacher"
      tabs={[
        { name: 'index', titleKey: 'tabs.today', icon: Sun },
        { name: 'attendance', titleKey: 'tabs.attendance', icon: ClipboardCheck },
        { name: 'calendar', titleKey: 'tabs.calendar', icon: CalendarDays, feature: 'calendar' },
        { name: 'messages', titleKey: 'tabs.messages', icon: MessageCircle, feature: 'messages' },
        { name: 'reports', titleKey: 'tabs.reports', icon: NotebookPen, feature: 'dailyReports' },
        { name: 'more', titleKey: 'tabs.more', icon: LayoutGrid },
        { name: 'profile', titleKey: 'tabs.profile', icon: UserRound },
      ]}
    />
  );
}
