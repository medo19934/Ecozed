import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { MY_DAY_KEY, useMyDay } from '@/lib/attendance';
import { useApiError } from '@/lib/use-api-error';
import { Card } from './ui';

/** Personal kiosk PIN: generated on request and shown once. */
export function PinCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const apiError = useApiError();
  const day = useMyDay();
  const [pin, setPin] = useState<string>();
  const [error, setError] = useState<string>();
  const gen = useMutation({
    mutationFn: () => api.post<{ pin: string }>('/attendance/me/pin'),
    onSuccess: (r) => {
      setPin(r.pin);
      void qc.invalidateQueries({ queryKey: MY_DAY_KEY });
    },
    onError: (e) => setError(apiError(e)),
  });
  if (!day.data?.kioskEnabled) return null;
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <KeyRound color="#5b6db4" size={20} />
        <Text className="flex-1 text-start text-base font-semibold text-ink">{t('att.pin')}</Text>
      </View>
      <Text className="text-start text-xs leading-5 text-ink-muted">
        {pin ? t('att.pinHint') : day.data.hasPin ? t('att.pinHas') : t('att.pinHint')}
      </Text>
      {pin && (
        <Text
          style={{ writingDirection: 'ltr', letterSpacing: 10 }}
          className="text-center text-3xl font-bold text-ink"
        >
          {pin}
        </Text>
      )}
      {error && <Text className="text-start text-sm text-danger">{error}</Text>}
      <Pressable
        accessibilityRole="button"
        disabled={gen.isPending}
        onPress={() => gen.mutate()}
        className="min-h-12 items-center justify-center rounded-2xl border border-line bg-white active:bg-line"
      >
        <Text className="text-base font-semibold text-brand">
          {day.data.hasPin || pin ? t('att.pinRegenerate') : t('att.pinGenerate')}
        </Text>
      </Pressable>
    </Card>
  );
}
