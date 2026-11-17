import { Baby } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';
import { WeekStrip } from './week-strip';

export function ParentHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <Screen>
      <ScreenHeader
        title={t('home.hello', { name: user?.fullName ?? '' })}
        subtitle={t('home.parentIntro')}
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text className="text-start text-base font-semibold text-ink">{t('home.thisWeek')}</Text>
        <WeekStrip />
        <Card className="flex-row items-start gap-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
            <Baby color="#5b6db4" size={24} />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-start text-base font-semibold text-ink">
                {t('home.enrollTitle')}
              </Text>
              <Text className="rounded-full bg-line px-2 py-0.5 text-[11px] text-ink-muted">
                {t('common.soon')}
              </Text>
            </View>
            <Text className="text-start text-sm leading-5 text-ink-muted">
              {t('home.enrollBody')}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
