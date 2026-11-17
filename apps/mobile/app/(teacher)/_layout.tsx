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
        { name: 'calendar', titleKey: 'tabs.calendar', icon: CalendarDays },
        { name: 'messages', titleKey: 'tabs.messages', icon: MessageCircle },
        { name: 'reports', titleKey: 'tabs.reports', icon: NotebookPen },
        { name: 'more', titleKey: 'tabs.more', icon: LayoutGrid },
        { name: 'profile', titleKey: 'tabs.profile', icon: UserRound },
      ]}
    />
  );
}
