import type { KioskPreview, KioskResult } from '@latif/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleAlert, CircleCheck, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/use-api-error';

type Stage =
  | { kind: 'camera' }
  | { kind: 'loading' }
  | { kind: 'choose'; token: string; preview: KioskPreview }
  | { kind: 'done'; result: KioskResult }
  | { kind: 'error'; message: string };

/** The kiosk QR is a link (…/scan?t=TOKEN); older codes are the bare token. */
const tokenFrom = (raw: string) => {
  if (raw.startsWith('lk1.')) return raw;
  const m = /[?&]t=([^&#]+)/.exec(raw);
  return m ? decodeURIComponent(m[1]!) : '';
};

/**
 * In-app scanner (or deep link latifkids://scan?t=…): preview who/which children →
 * choose in/out (+ children for parents) → check_in(token) → result with name, time, in/out.
 */
export default function ScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const apiError = useApiError();
  const params = useLocalSearchParams<{ t?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>({ kind: 'camera' });
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const startWith = async (raw: string) => {
    const token = tokenFrom(raw);
    if (locked.current || !token.startsWith('lk1.')) return;
    locked.current = true;
    setStage({ kind: 'loading' });
    try {
      const preview = await api.post<KioskPreview>('/attendance/kiosk/preview', { token });
      if (preview.kind === 'STAFF') setDirection(preview.staffNext ?? 'IN');
      else {
        const dir = preview.children.some((c) => c.next === 'IN') ? 'IN' : 'OUT';
        setDirection(dir);
        setPicked(preview.children.filter((c) => c.next === dir).map((c) => c.id));
      }
      setStage({ kind: 'choose', token, preview });
    } catch (e) {
      setStage({ kind: 'error', message: apiError(e) });
    }
  };

  // Opened from a link with the token: skip the camera.
  useEffect(() => {
    if (params.t) void startWith(params.t);
  }, [params.t]);

  const confirm = async () => {
    if (stage.kind !== 'choose') return;
    setBusy(true);
    try {
      const result = await api.post<KioskResult>('/attendance/kiosk/scan', {
        token: stage.token,
        direction,
        ...(stage.preview.kind === 'PARENT' ? { childIds: picked } : {}),
      });
      setStage({ kind: 'done', result });
      void qc.invalidateQueries({ queryKey: ['attendance'] });
    } catch (e) {
      setStage({ kind: 'error', message: apiError(e) });
    } finally {
      setBusy(false);
    }
  };
  const retry = () => {
    locked.current = false;
    setStage({ kind: 'camera' });
  };
  const time = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  const close = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('att.close')}
      onPress={() => router.back()}
      className="absolute end-4 z-10 h-11 w-11 items-center justify-center rounded-full bg-black/50"
      style={{ top: insets.top + 12 }}
    >
      <X color="#fff" size={22} />
    </Pressable>
  );

  if (stage.kind === 'camera') {
    if (!permission) return <View className="flex-1 bg-black" />;
    if (!permission.granted) {
      return (
        <View className="flex-1 items-center justify-center gap-4 bg-surface p-6">
          {close}
          <Text className="text-center text-base text-ink">{t('att.cameraDenied')}</Text>
          <PrimaryButton label={t('att.allowCamera')} onPress={() => void requestPermission()} />
        </View>
      );
    }
    return (
      <View className="flex-1 bg-black">
        {close}
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => void startWith(data)}
        />
        <View
          className="absolute inset-x-0 bottom-0 items-center gap-2 bg-black/60 p-6"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <Text className="text-center text-lg font-semibold text-white">{t('att.scanTitle')}</Text>
          <Text className="text-center text-sm text-white/80">{t('att.scanHint')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top + 64 }}>
      {close}
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' }}
      >
        {stage.kind === 'loading' && <ActivityIndicator color="#5b6db4" size="large" />}

        {stage.kind === 'error' && (
          <View className="items-center gap-4">
            <CircleAlert color="#e5484d" size={64} />
            <Text className="text-center text-lg font-semibold text-ink">{stage.message}</Text>
            <PrimaryButton label={t('att.scan')} onPress={retry} />
          </View>
        )}

        {stage.kind === 'done' && (
          <View className="items-center gap-4">
            <CircleCheck color="#2fb36d" size={64} />
            <Text className="text-center text-lg font-semibold text-ink">{t('att.recorded')}</Text>
            {stage.result.items.map((i) => (
              <View
                key={`${i.name}-${i.direction}`}
                className="w-full flex-row items-center justify-between rounded-2xl bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-ink">{i.name}</Text>
                <Text
                  className={`text-sm font-semibold ${i.direction === 'IN' ? 'text-success' : 'text-brand'}`}
                >
                  {i.direction === 'IN' ? t('att.doneIn') : t('att.doneOut')} · {time(i.at)}
                </Text>
              </View>
            ))}
            <PrimaryButton label={t('att.close')} onPress={() => router.back()} />
          </View>
        )}

        {stage.kind === 'choose' && (
          <View className="gap-4">
            <View className="items-center">
              <Text className="text-sm text-ink-muted">{stage.preview.branch.name}</Text>
              <Text className="text-lg font-semibold text-ink">{stage.preview.person}</Text>
            </View>
            <View className="flex-row gap-2">
              {(['IN', 'OUT'] as const).map((d) => (
                <Pressable
                  key={d}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: direction === d }}
                  onPress={() => {
                    setDirection(d);
                    if (stage.preview.kind === 'PARENT')
                      setPicked(
                        stage.preview.children.filter((c) => c.next === d).map((c) => c.id),
                      );
                  }}
                  className={`min-h-14 flex-1 items-center justify-center rounded-2xl border ${direction === d ? 'border-brand bg-brand' : 'border-line bg-white'}`}
                >
                  <Text
                    className={`text-base font-semibold ${direction === d ? 'text-white' : 'text-ink'}`}
                  >
                    {d === 'IN' ? t('att.checkIn') : t('att.checkOut')}
                  </Text>
                </Pressable>
              ))}
            </View>
            {stage.preview.kind === 'PARENT' ? (
              <View className="gap-2">
                <Text className="text-start text-sm font-medium text-ink">
                  {t('att.whichChildren')}
                </Text>
                {stage.preview.children.length === 0 && (
                  <Text className="text-start text-sm text-ink-muted">
                    {t('att.noChildrenHere')}
                  </Text>
                )}
                {stage.preview.children.map((c) => {
                  const ok = c.next === direction;
                  const on = picked.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: !ok }}
                      disabled={!ok}
                      onPress={() =>
                        setPicked((s) =>
                          s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id],
                        )
                      }
                      className={`min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4 ${ok ? '' : 'opacity-40'}`}
                    >
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-md border ${on ? 'border-brand bg-brand' : 'border-line'}`}
                      >
                        {on && <Check color="#fff" size={16} />}
                      </View>
                      <Text className="flex-1 text-start text-base text-ink">{c.fullName}</Text>
                      <Text className="text-xs text-ink-muted">{t(`status.${c.status}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              stage.preview.staffNext === null && (
                <Text className="text-center text-sm text-ink-muted">{t('att.alreadyOut')}</Text>
              )
            )}
            <PrimaryButton
              label={t('att.confirm')}
              loading={busy}
              disabled={
                stage.preview.kind === 'PARENT'
                  ? picked.length === 0
                  : stage.preview.staffNext !== direction
              }
              onPress={() => void confirm()}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
