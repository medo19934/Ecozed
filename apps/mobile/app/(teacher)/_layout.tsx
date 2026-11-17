import { ClipboardCheck, MessageCircle, Sun, UserRound } from 'lucide-react-native';
import { AreaTabs } from '@/components/area-tabs';

export default function TeacherLayout() {
  return (
    <AreaTabs
      area="teacher"
      tabs={[
        { name: 'index', titleKey: 'tabs.today', icon: Sun },
        { name: 'attendance', titleKey: 'tabs.attendance', icon: ClipboardCheck },
        { name: 'messages', titleKey: 'tabs.messages', icon: MessageCircle },
        { name: 'profile', titleKey: 'tabs.profile', icon: UserRound },
      ]}
    />
  );
}
