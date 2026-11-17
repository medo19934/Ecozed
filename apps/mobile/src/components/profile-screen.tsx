import { useRouter } from 'expo-router';
import { Languages, LockKeyhole, LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { changeLocale, i18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { PinCard } from './pin-card';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Text className="text-ink-muted">{label}</Text>
      <Text className="font-medium text-ink">{value ?? '—'}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const daycare = user?.memberships.find((m) => m.daycareId === user.daycareId)?.daycareName;

  return (
    <Screen>
      <ScreenHeader
        title={user?.fullName ?? ''}
        subtitle={user?.phone ?? user?.email ?? undefined}
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Card>
          <Row label={t('profile.role')} value={user?.role ? t(`roles.${user.role}`) : null} />
          <View className="h-px bg-line" />
          <Row label={t('profile.branch')} value={daycare} />
        </Card>
        {user?.daycareId && <PinCard />}
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('profile.restartNote')}
          onPress={() => changeLocale(i18n.language === 'ar' ? 'en' : 'ar')}
          className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4 active:bg-line"
        >
          <Languages color="#5b6db4" size={20} />
          <Text className="flex-1 text-start text-base text-ink">
            {t('profile.switchLanguage')}
          </Text>
          <Text className="font-medium text-brand">{t('language')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/password')}
          className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4 active:bg-line"
        >
          <LockKeyhole color="#5b6db4" size={20} />
          <Text className="flex-1 text-start text-base text-ink">{t('pw.title')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
          className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4 active:bg-line"
        >
          <LogOut color="#e5484d" size={20} />
          <Text className="text-start text-base font-medium text-danger">
            {t('profile.logout')}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
