import { localDate, type DailyReportDto, type SubscriptionDto } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/use-api-error';
import { ScreenHeader } from './screen-header';
import { Card, PrimaryButton, Screen } from './ui';

const MEALS = ['BREAKFAST', 'SNACK', 'LUNCH'] as const;
const AMOUNTS = ['ALL', 'MOST', 'SOME', 'NONE'] as const;
const MOODS = { HAPPY: '😊', CALM: '🙂', TIRED: '😴', SAD: '😢', UPSET: '😣' } as const;
type Meal = DailyReportDto['meals'][number];

const sar = (n: number) =>
  new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(n);
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function DailyReportsScreen() {
  const { user } = useAuth();
  return user?.role === 'PARENT' ? <ParentReports /> : <TeacherReports />;
}

function Summary({ r }: { r: DailyReportDto }) {
  const { t } = useTranslation();
  const line = (s: string) => (
    <Text key={s} className="text-start text-sm text-ink">
      {s}
    </Text>
  );
  return (
    <View className="gap-1">
      {r.meals.map((m) => line(`🍽️ ${t(`dr.meals.${m.meal}`)}: ${t(`dr.amounts.${m.amount}`)}`))}
      {r.napMinutes != null && line(`😴 ${t('dr.napValue', { n: r.napMinutes })}`)}
      {r.toilet != null && line(`🚻 ${t('dr.toiletValue', { n: r.toilet })}`)}
      {r.mood && line(`${MOODS[r.mood]} ${t(`dr.moods.${r.mood}`)}`)}
      {r.activities && line(`🎨 ${r.activities}`)}
      {r.notes && line(`📝 ${r.notes}`)}
    </View>
  );
}

function ParentReports() {
  const { t } = useTranslation();
  const reports = useQuery({
    queryKey: ['daily-reports', 'mine'],
    queryFn: () => api.get<DailyReportDto[]>('/daily-reports/mine'),
  });
  const subs = useQuery({
    queryKey: ['subscriptions', 'mine'],
    queryFn: () => api.get<SubscriptionDto[]>('/subscriptions/mine'),
  });
  const current = (subs.data ?? []).filter((s) => s.status !== 'CANCELED').slice(0, 3);
  return (
    <Screen>
      <ScreenHeader title={t('tabs.reports')} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={reports.isRefetching}
            onRefresh={() => {
              void reports.refetch();
              void subs.refetch();
            }}
          />
        }
      >
        {current.length > 0 && (
          <Text className="text-start text-base font-semibold text-ink">{t('dr.fees')}</Text>
        )}
        {current.map((s) => (
          <Card key={s.id} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-start text-base font-semibold text-ink">
                {s.child.fullName}
              </Text>
              <View
                className={`rounded-full px-3 py-1 ${s.paymentStatus === 'PAID' ? 'bg-green-100' : 'bg-red-100'}`}
              >
                <Text className={s.paymentStatus === 'PAID' ? 'text-success' : 'text-danger'}>
                  {t(`dr.pay.${s.paymentStatus}`)}
                </Text>
              </View>
            </View>
            <Text className="text-start text-sm text-ink-muted">
              {s.plan?.name ?? ''} · {sar(s.value)} · {s.startDate} → {s.endDate}
            </Text>
            {s.paymentStatus === 'UNPAID' && (
              <Text className="text-start text-sm text-danger">{t('dr.payOnSite')}</Text>
            )}
          </Card>
        ))}
        <Text className="mt-2 text-start text-base font-semibold text-ink">{t('dr.title')}</Text>
        {reports.isPending ? (
          <ActivityIndicator color="#5b6db4" />
        ) : (reports.data ?? []).length === 0 ? (
          <Card className="items-center py-8">
            <Text className="text-ink-muted">{t('dr.parentEmpty')}</Text>
          </Card>
        ) : (
          reports.data!.map((r) => (
            <Card key={`${r.child.id}-${r.date}`} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-start text-base font-semibold text-ink">
                  {r.child.fullName}
                </Text>
                <Text className="text-xs text-ink-muted">{r.date}</Text>
              </View>
              <Summary r={r} />
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function TeacherReports() {
  const { t } = useTranslation();
  const [date, setDate] = useState(localDate());
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['daily-reports', date],
    queryFn: () => api.get<DailyReportDto[]>(`/daily-reports?date=${date}`),
  });
  const rows = q.data ?? [];
  const done = rows.filter((r) => r.sharedAt).length;
  const today = localDate();
  return (
    <Screen>
      <ScreenHeader
        title={t('tabs.reports')}
        subtitle={rows.length ? t('dr.progress', { done, total: rows.length }) : undefined}
      />
      <View className="flex-row items-center justify-between px-5 pt-4">
        <Pressable
          accessibilityRole="button"
          onPress={() => setDate(shift(date, -1))}
          className="h-11 w-11 items-center justify-center rounded-full bg-white"
        >
          {i18n.language === 'ar' ? (
            <ChevronRight color="#5b6db4" />
          ) : (
            <ChevronLeft color="#5b6db4" />
          )}
        </Pressable>
        <Text className="text-base font-semibold text-ink">{date}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={date >= today}
          onPress={() => setDate(shift(date, 1))}
          className={`h-11 w-11 items-center justify-center rounded-full bg-white ${date >= today ? 'opacity-40' : ''}`}
        >
          {i18n.language === 'ar' ? (
            <ChevronLeft color="#5b6db4" />
          ) : (
            <ChevronRight color="#5b6db4" />
          )}
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {q.isPending ? (
          <ActivityIndicator color="#5b6db4" />
        ) : rows.length === 0 ? (
          <Card className="items-center py-8">
            <Text className="text-ink-muted">{t('dr.staffEmpty')}</Text>
          </Card>
        ) : (
          rows.map((r) => (
            <Card key={r.child.id} className="gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(open === r.child.id ? null : r.child.id)}
                className="flex-row items-center gap-3"
              >
                <View className="flex-1">
                  <Text className="text-start text-base font-semibold text-ink">
                    {r.child.fullName}
                  </Text>
                  <Text className="text-start text-xs text-ink-muted">
                    {r.child.classroom ?? ''}
                  </Text>
                </View>
                {r.sharedAt ? (
                  <CheckCircle2 color="#2fb36d" size={22} />
                ) : r.id ? (
                  <Text className="text-xs text-warning">{t('dr.draft')}</Text>
                ) : null}
              </Pressable>
              {open === r.child.id && <ReportForm report={r} onDone={() => setOpen(null)} />}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-9 justify-center rounded-full border px-3 ${on ? 'border-brand bg-brand' : 'border-line bg-white'}`}
    >
      <Text className={`text-sm ${on ? 'text-white' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

function ReportForm({ report, onDone }: { report: DailyReportDto; onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const apiError = useApiError();
  const [meals, setMeals] = useState<Partial<Record<Meal['meal'], Meal['amount']>>>(
    Object.fromEntries(report.meals.map((m) => [m.meal, m.amount])),
  );
  const [nap, setNap] = useState(report.napMinutes?.toString() ?? '');
  const [mood, setMood] = useState<DailyReportDto['mood']>(report.mood);
  const [activities, setActivities] = useState(report.activities ?? '');
  const [notes, setNotes] = useState(report.notes ?? '');
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: (share: boolean) =>
      fetchPut(report, { meals, nap, mood, activities, notes, share }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['daily-reports'] });
      void qc.invalidateQueries({ queryKey: ['messages'] });
      onDone();
    },
    onError: (e) => setError(apiError(e)),
  });
  const input =
    'min-h-12 rounded-2xl border border-line bg-surface px-4 text-start text-base text-ink';
  return (
    <View className="gap-3">
      {MEALS.map((m) => (
        <View key={m} className="gap-1.5">
          <Text className="text-start text-sm font-medium text-ink">{t(`dr.meals.${m}`)}</Text>
          <View className="flex-row flex-wrap gap-2">
            {AMOUNTS.map((a) => (
              <Chip
                key={a}
                label={t(`dr.amounts.${a}`)}
                on={meals[m] === a}
                onPress={() => setMeals((s) => ({ ...s, [m]: s[m] === a ? undefined : a }))}
              />
            ))}
          </View>
        </View>
      ))}
      <Text className="text-start text-sm font-medium text-ink">{t('dr.nap')}</Text>
      <TextInput value={nap} onChangeText={setNap} keyboardType="number-pad" className={input} />
      <Text className="text-start text-sm font-medium text-ink">{t('dr.mood')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {(Object.keys(MOODS) as (keyof typeof MOODS)[]).map((m) => (
          <Chip
            key={m}
            label={`${MOODS[m]} ${t(`dr.moods.${m}`)}`}
            on={mood === m}
            onPress={() => setMood(mood === m ? null : m)}
          />
        ))}
      </View>
      <TextInput
        value={activities}
        onChangeText={setActivities}
        placeholder={t('dr.activities')}
        placeholderTextColor="#9a9ab0"
        multiline
        className={`${input} py-3`}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t('dr.notes')}
        placeholderTextColor="#9a9ab0"
        multiline
        className={`${input} py-3`}
      />
      {error ? <Text className="text-start text-sm text-danger">{error}</Text> : null}
      <PrimaryButton
        label={t('dr.share')}
        loading={save.isPending}
        onPress={() => save.mutate(true)}
      />
    </View>
  );
}

function fetchPut(
  report: DailyReportDto,
  f: {
    meals: Partial<Record<Meal['meal'], Meal['amount']>>;
    nap: string;
    mood: DailyReportDto['mood'];
    activities: string;
    notes: string;
    share: boolean;
  },
) {
  return api.put<DailyReportDto>('/daily-reports', {
    childId: report.child.id,
    date: report.date,
    meals: MEALS.filter((m) => f.meals[m]).map((m) => ({ meal: m, amount: f.meals[m] })),
    napMinutes: f.nap === '' ? null : Number(f.nap),
    mood: f.mood,
    activities: f.activities,
    notes: f.notes,
    share: f.share,
  });
}
