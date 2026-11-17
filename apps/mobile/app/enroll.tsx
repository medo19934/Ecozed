import { CreateAdmissionSchema, type AdmissionDto, type BranchOption } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/screen-header';
import { StatusPill } from '@/components/status-pill';
import { Card, Field, PrimaryButton, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/use-api-error';

const PILL = { UNDER_REVIEW: 'VACATION', ACCEPTED: 'ATTENDED', REJECTED: 'ABSENT' } as const;
const LABEL = { UNDER_REVIEW: 'PENDING', ACCEPTED: 'APPROVED', REJECTED: 'REJECTED' } as const;

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 justify-center rounded-full border px-4 ${selected ? 'border-brand bg-brand-soft' : 'border-line bg-white'}`}
    >
      <Text className={`text-sm font-semibold ${selected ? 'text-brand' : 'text-ink'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function EnrollScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const apiError = useApiError();
  const { user } = useAuth();
  const branches = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<BranchOption[]>('/branches'),
  });
  const mine = useQuery({
    queryKey: ['admissions', 'mine'],
    queryFn: () => api.get<AdmissionDto[]>('/admissions/mine'),
  });
  const [f, setF] = useState({
    daycareId: '',
    childName: '',
    childGender: 'FEMALE' as 'MALE' | 'FEMALE',
    childBirthDate: '',
    guardianName: user?.fullName ?? '',
    relationship: i18n.language === 'ar' ? 'أم' : 'Mother',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    notes: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  useEffect(() => {
    if (branches.data?.[0] && !f.daycareId)
      setF((x) => ({ ...x, daycareId: branches.data[0]!.id }));
  }, [branches.data, f.daycareId]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const send = useMutation({
    mutationFn: (body: unknown) => api.post<AdmissionDto>('/admissions', body),
    onSuccess: () => {
      setMsg({ ok: true, text: t('enroll.sent') });
      setF((x) => ({ ...x, childName: '', childBirthDate: '', notes: '' }));
      void qc.invalidateQueries({ queryKey: ['admissions', 'mine'] });
    },
    onError: (e) => setMsg({ ok: false, text: apiError(e) }),
  });
  const ltr = { writingDirection: 'ltr' as const, textAlign: 'left' as const };

  return (
    <Screen>
      <ScreenHeader title={t('enroll.title')} subtitle={t('enroll.subtitle')} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card className="gap-4">
          <Text className="text-start text-sm font-medium text-ink">{t('enroll.branch')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {(branches.data ?? []).map((b) => (
              <Choice
                key={b.id}
                label={(i18n.language === 'en' && b.nameEn) || b.name}
                selected={f.daycareId === b.id}
                onPress={() => set('daycareId', b.id)}
              />
            ))}
          </View>
          <Field
            label={t('enroll.childName')}
            value={f.childName}
            onChangeText={(v) => set('childName', v)}
          />
          <Text className="text-start text-sm font-medium text-ink">{t('enroll.gender')}</Text>
          <View className="flex-row gap-2">
            <Choice
              label={t('enroll.girl')}
              selected={f.childGender === 'FEMALE'}
              onPress={() => set('childGender', 'FEMALE')}
            />
            <Choice
              label={t('enroll.boy')}
              selected={f.childGender === 'MALE'}
              onPress={() => set('childGender', 'MALE')}
            />
          </View>
          <Field
            label={t('enroll.birthDate')}
            value={f.childBirthDate}
            onChangeText={(v) => set('childBirthDate', v)}
            keyboardType="numbers-and-punctuation"
            placeholder="2022-05-14"
            style={ltr}
          />
          <Field
            label={t('enroll.guardianName')}
            value={f.guardianName}
            onChangeText={(v) => set('guardianName', v)}
          />
          <Field
            label={t('enroll.relationship')}
            value={f.relationship}
            onChangeText={(v) => set('relationship', v)}
          />
          <Field
            label={t('enroll.phone')}
            value={f.phone}
            onChangeText={(v) => set('phone', v)}
            keyboardType="phone-pad"
            placeholder="+9665XXXXXXXX"
            style={ltr}
          />
          <Field
            label={t('enroll.email')}
            value={f.email}
            onChangeText={(v) => set('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            style={ltr}
          />
          <Field
            label={t('enroll.notes')}
            value={f.notes}
            onChangeText={(v) => set('notes', v)}
            multiline
          />
          {msg && (
            <Text
              accessibilityRole="alert"
              className={`text-start text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}
            >
              {msg.text}
            </Text>
          )}
          <PrimaryButton
            label={t('enroll.submit')}
            loading={send.isPending}
            disabled={!f.daycareId}
            onPress={() => {
              const parsed = CreateAdmissionSchema.safeParse(f);
              if (!parsed.success) return setMsg({ ok: false, text: t('enroll.invalid') });
              send.mutate(parsed.data);
            }}
          />
        </Card>

        {!!mine.data?.length && (
          <>
            <Text className="text-start text-base font-semibold text-ink">{t('enroll.mine')}</Text>
            {mine.data.map((a) => (
              <View key={a.id} className="gap-2 rounded-3xl border border-line bg-white p-4">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-start font-semibold text-ink">{a.childName}</Text>
                  <StatusPill status={PILL[a.status]} label={t(`status.${LABEL[a.status]}`)} />
                </View>
                <Text className="text-start text-xs text-ink-muted">
                  {(i18n.language === 'en' && a.branch.nameEn) || a.branch.name} ·{' '}
                  {a.createdAt.slice(0, 10)}
                </Text>
                {a.rejectReason && (
                  <View className="rounded-2xl bg-surface p-3">
                    <Text className="text-start text-xs text-ink-muted">
                      {t('enroll.rejectReason')}
                    </Text>
                    <Text className="text-start text-sm text-ink">{a.rejectReason}</Text>
                  </View>
                )}
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
