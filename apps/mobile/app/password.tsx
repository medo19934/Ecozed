import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { ScreenHeader } from '@/components/screen-header';
import { Card, Field, GhostButton, PrimaryButton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { homeRouteFor } from '@/lib/roles';

/** Change password; `?forced=1` after signing in with an admin-issued temporary password. */
export default function PasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const isForced = forced === '1';
  const { user, refreshUser } = useAuth();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(undefined);
    if (f.next.length < 8) return setError(t('pw.tooShort'));
    if (f.next !== f.confirm) return setError(t('pw.mismatch'));
    setBusy(true);
    try {
      await api.post('/auth/password', {
        newPassword: f.next,
        ...(isForced ? {} : { currentPassword: f.current }),
      });
      await refreshUser();
      if (isForced) router.replace(homeRouteFor(user?.role));
      else setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'wrong_password' ? t('pw.wrong') : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title={isForced ? t('pw.forcedTitle') : t('pw.title')}
        subtitle={isForced ? t('pw.forcedHint') : undefined}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
        <Card className="gap-4">
          {!isForced && (
            <Field
              label={t('pw.current')}
              value={f.current}
              onChangeText={(v) => setF({ ...f, current: v })}
              secureTextEntry
              autoCapitalize="none"
            />
          )}
          <Field
            label={t('pw.new')}
            value={f.next}
            onChangeText={(v) => setF({ ...f, next: v })}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Field
            label={t('pw.confirm')}
            value={f.confirm}
            onChangeText={(v) => setF({ ...f, confirm: v })}
            secureTextEntry
            autoCapitalize="none"
          />
          {error ? (
            <Text accessibilityRole="alert" className="text-start text-sm text-danger">
              {error}
            </Text>
          ) : null}
          {done ? (
            <Text className="text-start text-sm font-medium text-success">{t('pw.changed')}</Text>
          ) : null}
          <PrimaryButton label={t('pw.save')} loading={busy} onPress={() => void save()} />
          {!isForced && <GhostButton label={t('msg.back')} onPress={() => router.back()} />}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
