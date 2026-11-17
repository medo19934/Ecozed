import type { KioskResult } from '@latif/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { CircleAlert, CircleCheck, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/use-api-error';

/** Scans the rotating QR on the entrance kiosk and records attendance. */
export default function ScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const apiError = useApiError();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { ok: true; data: KioskResult } | { ok: false; message: string } | null
  >(null);
  const locked = useRef(false);

  const onScan = async (data: string) => {
    if (locked.current || !data.startsWith('lk1.')) return;
    locked.current = true;
    setBusy(true);
    try {
      const r = await api.post<KioskResult>('/attendance/kiosk/scan', { token: data });
      setResult({ ok: true, data: r });
      void qc.invalidateQueries({ queryKey: ['attendance'] });
    } catch (e) {
      setResult({ ok: false, message: apiError(e) });
    } finally {
      setBusy(false);
    }
  };

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
      {!result && (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => void onScan(data)}
        />
      )}
      {!result && (
        <View
          className="absolute inset-x-0 bottom-0 items-center gap-2 bg-black/60 p-6"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <Text className="text-center text-lg font-semibold text-white">{t('att.scanTitle')}</Text>
          <Text className="text-center text-sm text-white/80">{t('att.scanHint')}</Text>
          {busy && <ActivityIndicator color="#fff" />}
        </View>
      )}
      {result && (
        <View className="flex-1 items-center justify-center gap-5 bg-surface p-6">
          {result.ok ? (
            <CircleCheck color="#2fb36d" size={64} />
          ) : (
            <CircleAlert color="#e5484d" size={64} />
          )}
          {result.ok ? (
            <View className="items-center gap-2">
              {result.data.items.map((i) => (
                <Text
                  key={`${i.name}-${i.direction}`}
                  className="text-center text-lg font-semibold text-ink"
                >
                  {i.name} — {i.direction === 'IN' ? t('att.doneIn') : t('att.doneOut')}
                </Text>
              ))}
            </View>
          ) : (
            <Text className="text-center text-lg font-semibold text-ink">{result.message}</Text>
          )}
          <View className="w-full max-w-sm gap-3">
            {!result.ok && (
              <PrimaryButton
                label={t('att.scan')}
                onPress={() => {
                  locked.current = false;
                  setResult(null);
                }}
              />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="min-h-12 items-center justify-center"
            >
              <Text className="text-base font-medium text-brand">{t('att.close')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
