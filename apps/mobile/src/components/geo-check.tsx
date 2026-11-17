import type { KioskResult } from '@latif/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text } from 'react-native';
import { api } from '@/lib/api';
import { useMyDay } from '@/lib/attendance';
import { useApiError } from '@/lib/use-api-error';
import { PrimaryButton } from './ui';

/** Staff check-in/out by location (inside the branch radius), after device biometrics. */
export function GeoCheck() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const apiError = useApiError();
  const day = useMyDay();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useMutation({
    mutationFn: async () => {
      if (
        Platform.OS !== 'web' &&
        (await LocalAuthentication.hasHardwareAsync()) &&
        (await LocalAuthentication.isEnrolledAsync())
      ) {
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: t('att.verifyIdentity'),
        });
        if (!auth.success) throw new Error('cancelled');
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('location');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return api.post<KioskResult>('/attendance/geo', {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      });
    },
    onSuccess: (r) => {
      const i = r.items[0];
      setMsg({ ok: true, text: i?.direction === 'OUT' ? t('att.doneOut') : t('att.doneIn') });
      void qc.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === 'cancelled') return;
      setMsg({
        ok: false,
        text:
          e instanceof Error && e.message === 'location' ? t('att.locationDenied') : apiError(e),
      });
    },
  });

  const g = day.data?.geofence;
  if (!g) return null;
  if (!g.enabled)
    return <Text className="text-start text-xs text-ink-muted">{t('att.geoDisabled')}</Text>;
  const checkedIn = Boolean(day.data?.staff?.checkInAt && !day.data.staff.checkOutAt);
  const done = Boolean(day.data?.staff?.checkOutAt);
  return (
    <>
      {!done && (
        <PrimaryButton
          label={checkedIn ? t('att.geoOut') : t('att.geo')}
          loading={run.isPending}
          onPress={() => {
            setMsg(null);
            run.mutate();
          }}
        />
      )}
      {msg && (
        <Text
          accessibilityRole="alert"
          className={`text-start text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}
        >
          <MapPin size={12} color={msg.ok ? '#2fb36d' : '#e5484d'} /> {msg.text}
        </Text>
      )}
    </>
  );
}
