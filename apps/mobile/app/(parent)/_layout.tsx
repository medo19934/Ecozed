import { CalendarDays, House, MessageCircle, NotebookPen, UserRound } from 'lucide-react-native';
import { AreaTabs } from '@/components/area-tabs';

export default function ParentLayout() {
  return (
    <AreaTabs
      area="parent"
      tabs={[
        { name: 'index', titleKey: 'tabs.home', icon: House },
        { name: 'calendar', titleKey: 'tabs.calendar', icon: CalendarDays, feature: 'calendar' },
        { name: 'messages', titleKey: 'tabs.messages', icon: MessageCircle, feature: 'messages' },
        { name: 'reports', titleKey: 'tabs.reports', icon: NotebookPen, feature: 'dailyReports' },
        { name: 'profile', titleKey: 'tabs.profile', icon: UserRound },
      ]}
    />
  );
}
