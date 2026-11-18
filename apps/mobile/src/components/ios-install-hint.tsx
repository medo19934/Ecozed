import { Share, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const KEY = 'lk-ios-hint-dismissed';

/** True on iPhone/iPad Safari when the app is not yet installed to the home screen. */
function shouldShow(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const ios =
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (!ios || nav.standalone || window.matchMedia('(display-mode: standalone)').matches)
    return false;
  try {
    return window.localStorage.getItem(KEY) !== '1';
  } catch {
    return true;
  }
}

/** iPhone without the App Store: explains Safari → Share → "Add to Home Screen" (web build only). */
export function IosInstallHint() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  useEffect(() => setShow(shouldShow()), []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      // Private mode: hint returns next visit, nothing else to do.
    }
  };
  return (
    <View
      className="absolute inset-x-3 z-50 flex-row items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-lg"
      style={{ bottom: insets.bottom + 12 }}
    >
      <Share color="#5b6db4" size={22} />
      <View className="flex-1 gap-1">
        <Text className="text-start text-base font-semibold text-ink">{t('install.title')}</Text>
        <Text className="text-start text-sm text-ink-muted">{t('install.body')}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('install.close')}
        onPress={close}
        className="h-8 w-8 items-center justify-center"
      >
        <X color="#8a8aa3" size={18} />
      </Pressable>
    </View>
  );
}
