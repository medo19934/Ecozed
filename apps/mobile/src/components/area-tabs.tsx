import { moduleOn, type FeatureToggle } from '@latif/shared';
import { Redirect, Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadMessages } from './messages-screen';
import { useAuth } from '@/lib/auth';
import { areaForRole, homeRouteFor, type AppArea } from '@/lib/roles';

export interface TabDef {
  name: string;
  titleKey: string;
  icon: LucideIcon;
  /** Hidden when this branch module is switched off (Settings > Modules). */
  feature?: FeatureToggle;
}

/** Bottom tabs for one role area; redirects users who don't belong here. */
export function AreaTabs({ area, tabs }: { area: AppArea; tabs: TabDef[] }) {
  const { t } = useTranslation();
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const unread = useUnreadMessages(status === 'signedIn');
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/(auth)/login" />;
  if (user?.mustChangePassword) return <Redirect href="/password?forced=1" />;
  if (areaForRole(user?.role) !== area) return <Redirect href={homeRouteFor(user?.role)} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#5b6db4',
        tabBarInactiveTintColor: '#8a8aa3',
        // Room for the Android gesture bar / iPhone home indicator.
        tabBarStyle: {
          height: 62 + Math.max(insets.bottom, 10),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          borderTopColor: '#e6e6f0',
        },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
      }}
    >
      {tabs.map(({ name, titleKey, icon: Icon, feature }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(titleKey),
            ...(feature && user && !moduleOn(user, feature) ? { href: null } : {}),
            tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
            ...(name === 'messages' && unread > 0
              ? {
                  tabBarBadge: unread > 99 ? '99+' : unread,
                  tabBarBadgeStyle: { backgroundColor: '#e5484d' },
                }
              : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
