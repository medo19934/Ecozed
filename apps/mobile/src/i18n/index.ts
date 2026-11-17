import { DEFAULT_LOCALE, isRtl, type Locale } from '@latif/shared';
import * as Updates from 'expo-updates';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager, Platform } from 'react-native';
import { secureStorage } from '@/lib/secure-storage';
import { resources } from './resources';

const LOCALE_KEY = 'lk.locale';

/** Initializes i18next and aligns native layout direction (RTL for Arabic). */
export async function initI18n(): Promise<void> {
  const stored = (await secureStorage.get(LOCALE_KEY)) as Locale | null;
  // Arabic is the product default; the user can switch from the profile tab.
  const lng = stored ?? DEFAULT_LOCALE;
  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  if (Platform.OS === 'web') {
    globalThis.document?.documentElement.setAttribute('dir', isRtl(lng) ? 'rtl' : 'ltr');
    return;
  }
  I18nManager.allowRTL(true);
  const rtl = isRtl(lng);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    await reload();
  }
}

async function reload(): Promise<void> {
  if (Platform.OS === 'web') return globalThis.location?.reload();
  try {
    await Updates.reloadAsync();
  } catch {
    if (__DEV__) DevSettings.reload();
  }
}

/** Persists the language and reloads so native RTL/LTR takes effect. */
export async function changeLocale(locale: Locale): Promise<void> {
  await secureStorage.set(LOCALE_KEY, locale);
  await i18n.changeLanguage(locale);
  if (Platform.OS === 'web') return reload();
  const rtl = isRtl(locale);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    await reload();
  }
}

export { i18n };
