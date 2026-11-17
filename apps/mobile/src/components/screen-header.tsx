import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_GRADIENT } from './ui';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={BRAND_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: insets.top + 16,
        paddingBottom: 28,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
      }}
    >
      <Text className="text-start text-2xl font-bold text-white">{title}</Text>
      {subtitle ? <Text className="mt-1 text-start text-white/80">{subtitle}</Text> : null}
    </LinearGradient>
  );
}
