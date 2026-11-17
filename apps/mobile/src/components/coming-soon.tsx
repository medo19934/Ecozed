import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';

export function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScreenHeader title={t(titleKey)} />
      <View className="p-5">
        <Card className="items-center gap-3 py-10">
          <Clock color="#6366f1" size={32} />
          <Text className="text-base font-medium text-ink-muted">{t('common.soon')}</Text>
        </Card>
      </View>
    </Screen>
  );
}
