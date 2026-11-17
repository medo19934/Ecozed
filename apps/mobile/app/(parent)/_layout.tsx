import { CalendarDays, House, MessageCircle, UserRound } from 'lucide-react-native';
import { AreaTabs } from '@/components/area-tabs';

export default function ParentLayout() {
  return (
    <AreaTabs
      area="parent"
      tabs={[
        { name: 'index', titleKey: 'tabs.home', icon: House },
        { name: 'calendar', titleKey: 'tabs.calendar', icon: CalendarDays },
        { name: 'messages', titleKey: 'tabs.messages', icon: MessageCircle },
        { name: 'profile', titleKey: 'tabs.profile', icon: UserRound },
      ]}
    />
  );
}
