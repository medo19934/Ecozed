import {
  localDate,
  VacationRequestSchema,
  type ParentChildDto,
  type VacationDto,
} from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/screen-header';
import { StatusPill } from '@/components/status-pill';
import { Card, Field, PrimaryButton, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/use-api-error';

const PILL = { PENDING: 'VACATION', APPROVED: 'ATTENDED', REJECTED: 'ABSENT' } as const;

export default function VacationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const apiError = useApiError();
  const kids = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => api.get<ParentChildDto[]>('/parent/children'),
  });
  const mine = useQuery({
    queryKey: ['vacations', 'mine'],
    queryFn: () => api.get<VacationDto[]>('/attendance/vacations/mine'),
  });
  const today = localDate();
  const [childId, setChildId] = useState<string>();
  const [startDate, setStart] = useState(today);
  const [endDate, setEnd] = useState(today);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const selected = childId ?? kids.data?.[0]?.id;

  const send = useMutation({
    mutationFn: (body: unknown) => api.post<VacationDto>('/attendance/vacations', body),
    onSuccess: () => {
      setMsg({ ok: true, text: t('att.sent') });
      void qc.invalidateQueries({ queryKey: ['vacations', 'mine'] });
    },
    onError: (e) => setMsg({ ok: false, text: apiError(e) }),
  });

  return (
    <Screen>
      <ScreenHeader title={t('att.vacationTitle')} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card className="gap-4">
          <Text className="text-start text-sm font-medium text-ink">{t('att.child')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {(kids.data ?? []).map((k) => (
              <Pressable
                key={k.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: k.id === selected }}
                onPress={() => setChildId(k.id)}
                className={`min-h-11 justify-center rounded-full border px-4 ${k.id === selected ? 'border-brand bg-brand-soft' : 'border-line bg-white'}`}
              >
                <Text
                  className={`text-sm font-semibold ${k.id === selected ? 'text-brand' : 'text-ink'}`}
                >
                  {k.fullName}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label={t('att.from')}
            value={startDate}
            onChangeText={setStart}
            keyboardType="numbers-and-punctuation"
            style={{ writingDirection: 'ltr', textAlign: 'left' }}
          />
          <Field
            label={t('att.to')}
            value={endDate}
            onChangeText={setEnd}
            keyboardType="numbers-and-punctuation"
            style={{ writingDirection: 'ltr', textAlign: 'left' }}
          />
          <Field label={t('att.reason')} value={reason} onChangeText={setReason} multiline />
          {msg && (
            <Text
              accessibilityRole="alert"
              className={`text-start text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}
            >
              {msg.text}
            </Text>
          )}
          <PrimaryButton
            label={t('att.send')}
            loading={send.isPending}
            disabled={!selected}
            onPress={() => {
              const parsed = VacationRequestSchema.safeParse({
                childId: selected,
                startDate,
                endDate,
                reason: reason || undefined,
              });
              if (!parsed.success) {
                const code = parsed.error.issues[0]?.message;
                return setMsg({
                  ok: false,
                  text:
                    code === 'date_range_invalid'
                      ? t('errors.date_range_invalid')
                      : t('common.error'),
                });
              }
              send.mutate(parsed.data);
            }}
          />
        </Card>

        {!!mine.data?.length && (
          <>
            <Text className="text-start text-base font-semibold text-ink">
              {t('att.myRequests')}
            </Text>
            {mine.data.map((v) => (
              <View
                key={v.id}
                className="flex-row items-center justify-between gap-3 rounded-3xl border border-line bg-white p-4"
              >
                <View className="flex-1">
                  <Text className="text-start font-semibold text-ink">{v.child.fullName}</Text>
                  <Text className="text-start text-xs text-ink-muted">
                    {v.startDate} → {v.endDate}
                  </Text>
                </View>
                <View>
                  <StatusPill status={PILL[v.status]} />
                </View>
              </View>
            ))}
          </>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="min-h-12 items-center justify-center"
        >
          <Text className="text-base font-medium text-brand">{t('att.close')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
