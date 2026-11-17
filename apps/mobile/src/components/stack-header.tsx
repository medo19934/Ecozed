import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '@/i18n';

/** Header with a back button for pushed screens (RTL-aware arrow). */
export function StackHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center gap-3 border-b border-line bg-white px-3 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('msg.back')}
        onPress={() => router.back()}
        className="h-11 w-11 items-center justify-center"
      >
        <ArrowRight
          color="#1f2433"
          size={22}
          style={{ transform: [{ scaleX: i18n.language === 'ar' ? 1 : -1 }] }}
        />
      </Pressable>
      <Text className="flex-1 text-start text-lg font-semibold text-ink">{title}</Text>
    </View>
  );
}
