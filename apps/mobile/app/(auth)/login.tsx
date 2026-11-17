import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Baby, BriefcaseBusiness, Sparkles } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoogleButton } from '@/components/google-button';
import { BRAND_GRADIENT, Card, Field, PrimaryButton } from '@/components/ui';
import { changeLocale, i18n } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { homeRouteFor } from '@/lib/roles';

const DEV_LOGIN = process.env.EXPO_PUBLIC_AUTH_DEV_LOGIN === 'true';

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [devEmail, setDevEmail] = useState('');

  const run = useCallback(
    async (fn: () => Promise<{ role: Parameters<typeof homeRouteFor>[0] }>) => {
      setBusy(true);
      setError(undefined);
      try {
        const user = await fn();
        router.replace(homeRouteFor(user.role));
      } catch (e) {
        setError(
          e instanceof ApiError && e.code === 'account_disabled'
            ? t('auth.disabled')
            : t('auth.failed'),
        );
      } finally {
        setBusy(false);
      }
    },
    [router, t],
  );

  const onIdToken = useCallback(
    (token: string) => run(() => auth.signInWithGoogle(token, i18n.language)),
    [run, auth],
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient
          colors={BRAND_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 16, paddingBottom: 72, paddingHorizontal: 24 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                <Sparkles color="#fff" size={22} />
              </View>
              <Text className="text-xl font-bold text-white">{t('appName')}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => changeLocale(i18n.language === 'ar' ? 'en' : 'ar')}
              className="min-h-11 justify-center rounded-xl bg-white/15 px-3"
            >
              <Text className="font-medium text-white">{t('language')}</Text>
            </Pressable>
          </View>
          <Text className="mt-8 text-start text-2xl font-bold text-white">{t('auth.title')}</Text>
          <Text className="mt-2 text-start text-base text-white/85">{t('auth.subtitle')}</Text>
        </LinearGradient>

        <View className="-mt-12 flex-1 px-5 pb-10">
          <Card className="gap-5">
            <GoogleButton onIdToken={onIdToken} busy={busy} />
            {error ? (
              <Text accessibilityRole="alert" className="text-start text-sm text-danger">
                {error}
              </Text>
            ) : null}
            <View className="gap-3">
              <View className="flex-row items-start gap-3">
                <Baby color="#5b6db4" size={18} />
                <Text className="flex-1 text-start text-sm leading-5 text-ink-muted">
                  {t('auth.parentsNote')}
                </Text>
              </View>
              <View className="flex-row items-start gap-3">
                <BriefcaseBusiness color="#5b6db4" size={18} />
                <Text className="flex-1 text-start text-sm leading-5 text-ink-muted">
                  {t('auth.staffNote')}
                </Text>
              </View>
            </View>
          </Card>

          {DEV_LOGIN && (
            <Card className="mt-4 gap-4 border-dashed">
              <Text className="text-start text-sm font-semibold text-ink">
                {t('common.dev')} · {t('auth.devTitle')}
              </Text>
              <Field
                label={t('auth.devEmail')}
                value={devEmail}
                onChangeText={setDevEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{ writingDirection: 'ltr', textAlign: 'left' }}
              />
              <PrimaryButton
                label={t('auth.devSubmit')}
                loading={busy}
                onPress={() => run(() => auth.devLogin(devEmail.trim()))}
              />
            </Card>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
