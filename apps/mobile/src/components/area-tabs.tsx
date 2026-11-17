import { Redirect, Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { areaForRole, homeRouteFor, type AppArea } from '@/lib/roles';

export interface TabDef {
  name: string;
  titleKey: string;
  icon: LucideIcon;
}

/** Bottom tabs for one role area; redirects users who don't belong here. */
export function AreaTabs({ area, tabs }: { area: AppArea; tabs: TabDef[] }) {
  const { t } = useTranslation();
  const { status, user } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/(auth)/login" />;
  if (areaForRole(user?.role) !== area) return <Redirect href={homeRouteFor(user?.role)} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#5b6db4',
        tabBarInactiveTintColor: '#8a8aa3',
        tabBarStyle: { height: 76, paddingTop: 8, paddingBottom: 14, borderTopColor: '#e6e6f0' },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
      }}
    >
      {tabs.map(({ name, titleKey, icon: Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(titleKey),
            tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
