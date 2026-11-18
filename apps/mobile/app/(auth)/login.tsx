import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { DemoAccount } from '@latif/shared';
import { Baby, Building2, GraduationCap, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import logoMark from '../../assets/logo-mark.png';
import { GoogleButton } from '@/components/google-button';
import { BRAND_GRADIENT, Card, Field, PrimaryButton } from '@/components/ui';
import { changeLocale, i18n } from '@/i18n';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { homeRouteFor } from '@/lib/roles';

const DEV_LOGIN = process.env.EXPO_PUBLIC_AUTH_DEV_LOGIN === 'true';
const ICONS = {
  SUPER_ADMIN: ShieldCheck,
  MANAGER: Building2,
  STAFF: GraduationCap,
  PARENT: Baby,
} as const;

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [devEmail, setDevEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [publicDemo, setPublicDemo] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [picked, setPicked] = useState<string>();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [google, setGoogle] = useState(false);
  type Branch = { slug: string; name: string; nameEn: string | null };
  const [branches, setBranches] = useState<Branch[]>([]);
  const [role, setRole] = useState<{ role: keyof typeof ICONS; branch?: Branch } | null>(null);
  const branchName = (b: Branch) => (i18n.language === 'en' && b.nameEn ? b.nameEn : b.name);

  useEffect(() => {
    api
      .publicGet<{ publicDemo: boolean; google: boolean; branches?: Branch[] }>('/auth/options')
      .then(async (o) => {
        setPublicDemo(o.publicDemo);
        setGoogle(o.google);
        setBranches(o.branches ?? []);
        if (o.publicDemo) setAccounts(await api.publicGet<DemoAccount[]>('/auth/demo-accounts'));
      })
      .catch(() => setPublicDemo(false));
  }, []);

  const run = useCallback(
    async (
      fn: () => Promise<{ role: Parameters<typeof homeRouteFor>[0]; mustChangePassword: boolean }>,
    ) => {
      setBusy(true);
      setError(undefined);
      try {
        const user = await fn();
        router.replace(user.mustChangePassword ? '/password?forced=1' : homeRouteFor(user.role));
      } catch (e) {
        setError(
          e instanceof ApiError && e.code === 'account_disabled'
            ? t('auth.disabled')
            : e instanceof ApiError && e.code === 'invalid_credentials'
              ? t('auth.invalidCredentials')
              : e instanceof ApiError && e.code === 'account_exists'
                ? t('auth.accountExists')
                : e instanceof ApiError && e.status === 404
                  ? t('auth.notFound')
                  : publicDemo
                    ? t('common.error')
                    : t('auth.failed'),
        );
      } finally {
        setBusy(false);
        setPicked(undefined);
      }
    },
    [router, t, publicDemo],
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
              <Image
                source={logoMark}
                accessibilityIgnoresInvertColors
                style={{ width: 40, height: 40, borderRadius: 12 }}
              />
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
          <Text className="mt-2 text-start text-base text-white/85">
            {publicDemo ? t('auth.publicSubtitle') : t('auth.passwordSubtitle')}
          </Text>
        </LinearGradient>

        <View className="-mt-12 flex-1 px-5 pb-10">
          {publicDemo === null ? (
            <Card className="items-center py-10">
              <ActivityIndicator color="#5b6db4" />
            </Card>
          ) : publicDemo ? (
            <Card className="gap-5">
              {groups(accounts).map((g) => (
                <View key={g.key} className="gap-2">
                  <Text className="text-start text-sm font-semibold text-ink-muted">
                    {g.title ?? t('auth.generalAdmin')}
                  </Text>
                  <View className="flex-row gap-2">
                    {g.items.map((a) => {
                      const Icon = ICONS[a.role as keyof typeof ICONS] ?? Baby;
                      return (
                        <Pressable
                          key={a.email}
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() => {
                            setPicked(a.email);
                            void run(() => auth.login(a.email, i18n.language));
                          }}
                          className="flex-1 items-center gap-1.5 rounded-2xl border border-line bg-white p-3"
                        >
                          <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand">
                            {picked === a.email ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Icon color="#fff" size={20} />
                            )}
                          </View>
                          <Text className="text-center text-sm font-semibold text-ink">
                            {t(`auth.roles.${a.role}`)}
                          </Text>
                          <Text numberOfLines={1} className="text-center text-xs text-ink-muted">
                            {a.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Field
                label={t('auth.identifier')}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="name@example.com · 05XXXXXXXX"
                style={{ writingDirection: 'ltr', textAlign: 'left' }}
              />
              {error ? (
                <Text accessibilityRole="alert" className="text-start text-sm text-danger">
                  {error}
                </Text>
              ) : null}
              <PrimaryButton
                label={t('auth.signIn')}
                loading={busy && !picked}
                onPress={() =>
                  identifier.trim() && run(() => auth.login(identifier.trim(), i18n.language))
                }
              />
            </Card>
          ) : !role ? (
            <Card className="gap-5">
              <Text className="text-start text-sm text-ink-muted">{t('auth.pickRole')}</Text>
              {[
                {
                  key: 'admin',
                  title: t('auth.generalAdmin'),
                  roles: ['SUPER_ADMIN' as const],
                  branch: undefined as Branch | undefined,
                },
                ...branches.map((b) => ({
                  key: b.slug,
                  title: branchName(b),
                  roles: ['MANAGER', 'STAFF', 'PARENT'] as const,
                  branch: b,
                })),
              ].map((g) => (
                <View key={g.key} className="gap-2">
                  <Text className="text-start text-sm font-semibold text-ink-muted">{g.title}</Text>
                  <View className="flex-row gap-2">
                    {g.roles.map((r) => {
                      const Icon = ICONS[r];
                      return (
                        <Pressable
                          key={r}
                          accessibilityRole="button"
                          onPress={() => {
                            setRole({ role: r, branch: g.branch });
                            setMode('login');
                            setError(undefined);
                          }}
                          className="flex-1 items-center gap-1.5 rounded-2xl border border-line bg-white p-3"
                        >
                          <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand">
                            <Icon color="#fff" size={20} />
                          </View>
                          <Text className="text-center text-sm font-semibold text-ink">
                            {t(`auth.roles.${r}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </Card>
          ) : (
            <Card className="gap-5">
              <Pressable
                accessibilityRole="button"
                onPress={() => setRole(null)}
                className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3"
              >
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand">
                  {(() => {
                    const Icon = ICONS[role.role];
                    return <Icon color="#fff" size={20} />;
                  })()}
                </View>
                <View className="flex-1">
                  <Text className="text-start text-base font-semibold text-ink">
                    {t(`auth.roles.${role.role}`)}
                  </Text>
                  <Text className="text-start text-xs text-ink-muted">
                    {role.branch ? branchName(role.branch) : t('auth.allBranches')}
                  </Text>
                </View>
                <Text className="text-sm font-medium text-brand">{t('auth.changeRole')}</Text>
              </Pressable>
              {role.role === 'PARENT' && (
                <View className="flex-row gap-1 rounded-2xl bg-surface p-1">
                  {(['login', 'register'] as const).map((m) => (
                    <Pressable
                      key={m}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: mode === m }}
                      onPress={() => {
                        setMode(m);
                        setError(undefined);
                      }}
                      className={`min-h-11 flex-1 items-center justify-center rounded-xl ${mode === m ? 'bg-white' : ''}`}
                    >
                      <Text
                        className={`text-sm ${mode === m ? 'font-semibold text-ink' : 'text-ink-muted'}`}
                      >
                        {t(m === 'login' ? 'auth.tabLogin' : 'auth.tabRegister')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {mode === 'register' && (
                <Field
                  label={t('auth.fullName')}
                  value={fullName}
                  onChangeText={setFullName}
                  autoComplete="name"
                />
              )}
              <Field
                label={t('auth.identifier')}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoComplete="username"
                keyboardType="email-address"
                placeholder="name@example.com · 05XXXXXXXX"
                style={{ writingDirection: 'ltr', textAlign: 'left' }}
              />
              <Field
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{ writingDirection: 'ltr', textAlign: 'left' }}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPw((v) => !v)}
                className="-mt-3 self-end py-1"
              >
                <Text className="text-sm font-medium text-brand">
                  {t(showPw ? 'auth.hidePassword' : 'auth.showPassword')}
                </Text>
              </Pressable>
              {error ? (
                <Text accessibilityRole="alert" className="text-start text-sm text-danger">
                  {error}
                </Text>
              ) : null}
              <PrimaryButton
                label={t(mode === 'login' ? 'auth.signIn' : 'auth.createAccount')}
                loading={busy}
                onPress={() => {
                  const id = identifier.trim();
                  if (!id || !password) return setError(t('auth.fillAll'));
                  if (mode === 'register' && password.length < 8)
                    return setError(t('auth.passwordHint'));
                  if (mode === 'register' && fullName.trim().length < 2)
                    return setError(t('auth.fillAll'));
                  void run(() =>
                    mode === 'login'
                      ? auth.login(id, i18n.language, password)
                      : auth.register({
                          fullName: fullName.trim(),
                          identifier: id,
                          password,
                          locale: i18n.language,
                        }),
                  );
                }}
              />
              <Text className="text-start text-sm leading-5 text-ink-muted">
                {t(mode === 'login' ? 'auth.loginHelp' : 'auth.registerHelp')}
              </Text>
              {google && <GoogleButton onIdToken={onIdToken} busy={busy} />}
            </Card>
          )}

          {DEV_LOGIN && !publicDemo && (
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

/** General admin first, then one row per branch (manager · teacher · parent). */
function groups(accounts: DemoAccount[]) {
  const out: { key: string; title: string | null; items: DemoAccount[] }[] = [];
  for (const a of accounts) {
    const key = a.branch?.slug ?? 'admin';
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        title: a.branch
          ? i18n.language === 'en' && a.branch.nameEn
            ? a.branch.nameEn
            : a.branch.name
          : null,
        items: [],
      };
      out.push(g);
    }
    g.items.push(a);
  }
  return out;
}
