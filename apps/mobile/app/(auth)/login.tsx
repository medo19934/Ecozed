import { OTP, PhoneSchema, type AuthUser } from '@latif/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BRAND_GRADIENT,
  Card,
  Field,
  GhostButton,
  PrimaryButton,
  Segmented,
} from '@/components/ui';
import { changeLocale, i18n } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { areaForRole, homeRouteFor, type AppArea } from '@/lib/roles';

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const [area, setArea] = useState<AppArea>('parent');
  const [phone, setPhone] = useState('+966');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const finish = async (user: AuthUser) => {
    if (areaForRole(user.role) !== area) {
      // Signed in to the wrong experience (e.g. a teacher on the parent tab).
      if (!areaForRole(user.role)) {
        await auth.signOut();
        return setError(t('auth.wrongApp'));
      }
    }
    router.replace(homeRouteFor(user.role));
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      const c = e instanceof ApiError ? e.code : undefined;
      setError(
        c === 'invalid_code'
          ? t('auth.invalidCode')
          : c === 'invalid_credentials'
            ? t('auth.invalidCredentials')
            : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => {
    if (!PhoneSchema.safeParse(phone).success) return setError(t('auth.invalidPhone'));
    return run(async () => {
      const res = await auth.requestOtp(phone);
      setCodeSent(true);
      if (res.devCode) Alert.alert(t('auth.devCode', { code: res.devCode }));
    });
  };

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
          <Text className="mt-8 text-start text-2xl font-bold text-white">{t('tagline')}</Text>
        </LinearGradient>

        <View className="-mt-12 flex-1 px-5 pb-10">
          <Card className="gap-5">
            <Text className="text-start text-sm font-medium text-ink-muted">{t('auth.iAm')}</Text>
            <Segmented
              value={area}
              onChange={(v) => {
                setArea(v);
                setError(undefined);
              }}
              options={[
                { value: 'parent', label: t('auth.parent') },
                { value: 'teacher', label: t('auth.teacher') },
              ]}
            />

            {area === 'parent' ? (
              <>
                <Field
                  label={t('auth.phone')}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ''))}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  style={{ writingDirection: 'ltr', textAlign: 'left' }}
                  editable={!codeSent}
                  error={!codeSent ? error : undefined}
                />
                {codeSent && (
                  <Field
                    label={t('auth.code')}
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, OTP.LENGTH))}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={OTP.LENGTH}
                    style={{ letterSpacing: 8, textAlign: 'center', fontSize: 22 }}
                    error={error}
                  />
                )}
                <PrimaryButton
                  label={codeSent ? t('auth.verify') : t('auth.sendCode')}
                  loading={busy}
                  onPress={() =>
                    codeSent
                      ? run(async () => finish(await auth.signInWithOtp(phone, code)))
                      : sendCode()
                  }
                />
                {codeSent && <GhostButton label={t('auth.resend')} onPress={sendCode} />}
              </>
            ) : (
              <>
                <Field
                  label={t('auth.identifier')}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoComplete="username"
                  keyboardType="email-address"
                  style={{ writingDirection: 'ltr', textAlign: 'left' }}
                />
                <Field
                  label={t('auth.password')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  error={error}
                />
                <PrimaryButton
                  label={t('auth.login')}
                  loading={busy}
                  onPress={() =>
                    run(async () =>
                      finish(await auth.signInWithPassword(identifier.trim(), password)),
                    )
                  }
                />
              </>
            )}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
