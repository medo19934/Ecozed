import { menuFor, type MenuKey } from '@latif/shared';
import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  BarChart3,
  Baby,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Contact,
  CreditCard,
  School,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text } from 'react-native';
import { ScreenHeader } from '@/components/screen-header';
import { Screen } from '@/components/ui';
import { i18n } from '@/i18n';
import { useAuth } from '@/lib/auth';

/** Items already reachable from the tabs. */
const IN_TABS: MenuKey[] = ['dashboard', 'attendance', 'calendar', 'messages', 'dailyReports'];
const ICONS: Partial<Record<MenuKey, LucideIcon>> = {
  children: Baby,
  parents: Contact,
  staff: Users,
  classes: School,
  units: BookOpen,
  admissions: UserPlus,
  subscriptions: CreditCard,
  reports: BarChart3,
  settings: Settings,
};
/** Native screens; everything else opens the same web page in the in-app browser. */
const NATIVE: Partial<Record<MenuKey, Href>> = {
  children: '/children',
  admissions: '/admissions',
  subscriptions: '/subscriptions',
};
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://latif-kids.vercel.app';

/** The rest of the role's menu — same list and rules as the web sidebar (@latif/shared menuFor). */
export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const items = menuFor(user).filter((m) => !IN_TABS.includes(m.key));
  const Chevron = i18n.language === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <Screen>
      <ScreenHeader title={t('tabs.more')} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {items.map((m) => {
          const Icon = ICONS[m.key] ?? Settings;
          const native = NATIVE[m.key];
          return (
            <Pressable
              key={m.key}
              accessibilityRole="button"
              onPress={() =>
                native
                  ? router.push(native)
                  : void WebBrowser.openBrowserAsync(
                      `${WEB_URL}/${i18n.language === 'en' ? 'en' : 'ar'}${m.path}`,
                    )
              }
              className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4 active:bg-line"
            >
              <Icon color="#5b6db4" size={20} />
              <Text className="flex-1 text-start text-base text-ink">{t(`menu.${m.key}`)}</Text>
              {!native && <Text className="text-xs text-ink-muted">{t('menu.onWeb')}</Text>}
              <Chevron color="#8a8aa3" size={18} />
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
