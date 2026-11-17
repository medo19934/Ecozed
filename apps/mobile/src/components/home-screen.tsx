import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';

export function HomeScreen({ introKey }: { introKey: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const daycare = user?.memberships.find((m) => m.daycareId === user.daycareId)?.daycareName;
  return (
    <Screen>
      <ScreenHeader title={t('home.hello', { name: user?.fullName ?? '' })} subtitle={daycare} />
      <View className="p-5">
        <Card>
          <Text className="text-start text-base leading-6 text-ink">{t(introKey)}</Text>
        </Card>
      </View>
    </Screen>
  );
}
