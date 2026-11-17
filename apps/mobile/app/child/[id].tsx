import type {
  ChildDetail,
  DailyReportDto,
  MyAttendance,
  ParentChildDto,
  SubscriptionDto,
} from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChildPhoto } from '@/components/child-row';
import { StatusPill } from '@/components/status-pill';
import { Card } from '@/components/ui';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const MOODS = { HAPPY: '😊', CALM: '🙂', TIRED: '😴', SAD: '😢', UPSET: '😣' } as const;
const sar = (n: number) =>
  new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(n);

/** Child profile: same data the web shows for this role (parents: own child; staff: permitted). */
export default function ChildProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const parent = user?.role === 'PARENT';

  const staffChild = useQuery({
    queryKey: ['children', id],
    queryFn: () => api.get<ChildDetail>(`/children/${id}`),
    enabled: !parent,
  });
  const myKids = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => api.get<ParentChildDto[]>('/parent/children'),
    enabled: parent,
  });
  const day = useQuery({
    queryKey: ['attendance', 'me'],
    queryFn: () => api.get<MyAttendance>('/attendance/me'),
    enabled: parent,
  });
  const reports = useQuery({
    queryKey: ['daily-reports', 'mine'],
    queryFn: () => api.get<DailyReportDto[]>('/daily-reports/mine'),
    enabled: parent,
  });
  const subs = useQuery({
    queryKey: ['subscriptions', 'mine'],
    queryFn: () => api.get<SubscriptionDto[]>('/subscriptions/mine'),
    enabled: parent,
  });

  const kid = parent ? myKids.data?.find((k) => k.id === id) : staffChild.data;
  const loading = parent ? myKids.isPending : staffChild.isPending;
  const today = day.data?.children.find((c) => c.id === id);
  const myReports = (reports.data ?? []).filter((r) => r.child.id === id).slice(0, 5);
  const fees = (subs.data ?? []).filter((s) => s.child.id === id && s.status !== 'CANCELED');
  const detail = !parent ? staffChild.data : undefined;

  return (
    <View className="flex-1 bg-surface">
      <View
        className="flex-row items-center gap-3 border-b border-line bg-white px-3 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('msg.back')}
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center"
        >
          <ArrowRight
            color="#1f2433"
            size={22}
            style={{ transform: [{ scaleX: i18n.language === 'ar' ? 1 : -1 }] }}
          />
        </Pressable>
        <Text className="flex-1 text-start text-lg font-semibold text-ink">
          {kid?.fullName ?? ''}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator className="mt-10" color="#5b6db4" />
      ) : !kid ? (
        <Text className="mt-10 text-center text-ink-muted">{t('child.notFound')}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 24 }}
        >
          <Card className="items-center gap-2">
            <ChildPhoto
              path={
                kid.hasPhoto
                  ? parent
                    ? `/parent/children/${kid.id}/photo`
                    : `/children/${kid.id}/photo`
                  : null
              }
              gender={kid.gender}
              size={88}
            />
            <Text className="text-lg font-semibold text-ink">{kid.fullName}</Text>
            <Text className="text-sm text-ink-muted">
              {kid.classroom?.name ?? t('home.noClass')} · {kid.birthDate}
            </Text>
            {today && <StatusPill status={today.status} />}
          </Card>

          {detail && (
            <Card className="gap-2">
              <Text className="text-start text-base font-semibold text-ink">
                {t('child.guardians')}
              </Text>
              {detail.guardians.map((g) => (
                <Text key={g.id} className="text-start text-sm text-ink">
                  {g.fullName} ({g.relationship}) · {g.phone ?? g.email ?? ''}
                </Text>
              ))}
              {detail.allergies ? (
                <Text className="text-start text-sm text-danger">⚠️ {detail.allergies}</Text>
              ) : null}
              {detail.medicalNotes ? (
                <Text className="text-start text-sm text-ink-muted">{detail.medicalNotes}</Text>
              ) : null}
              {detail.pickupPeople.length > 0 && (
                <Text className="text-start text-sm text-ink-muted">
                  {t('child.pickup')}: {detail.pickupPeople.map((p) => p.name).join('، ')}
                </Text>
              )}
            </Card>
          )}

          {parent && (
            <>
              <Text className="text-start text-base font-semibold text-ink">{t('dr.title')}</Text>
              {myReports.length === 0 ? (
                <Card>
                  <Text className="text-start text-sm text-ink-muted">{t('dr.parentEmpty')}</Text>
                </Card>
              ) : (
                myReports.map((r) => (
                  <Card key={r.date} className="gap-1">
                    <Text className="text-start text-xs text-ink-muted">{r.date}</Text>
                    {r.mood && (
                      <Text className="text-start text-sm text-ink">
                        {MOODS[r.mood]} {t(`dr.moods.${r.mood}`)}
                      </Text>
                    )}
                    {r.meals.map((m) => (
                      <Text key={m.meal} className="text-start text-sm text-ink">
                        🍽️ {t(`dr.meals.${m.meal}`)}: {t(`dr.amounts.${m.amount}`)}
                      </Text>
                    ))}
                    {r.napMinutes != null && (
                      <Text className="text-start text-sm text-ink">
                        😴 {t('dr.napValue', { n: r.napMinutes })}
                      </Text>
                    )}
                    {r.activities ? (
                      <Text className="text-start text-sm text-ink">🎨 {r.activities}</Text>
                    ) : null}
                    {r.notes ? (
                      <Text className="text-start text-sm text-ink">📝 {r.notes}</Text>
                    ) : null}
                  </Card>
                ))
              )}
              {fees.length > 0 && (
                <Text className="text-start text-base font-semibold text-ink">{t('dr.fees')}</Text>
              )}
              {fees.map((s) => (
                <Card key={s.id} className="flex-row items-center justify-between">
                  <Text className="text-start text-sm text-ink">
                    {s.plan?.name ?? ''} · {sar(s.value)}
                  </Text>
                  <Text className={s.paymentStatus === 'PAID' ? 'text-success' : 'text-danger'}>
                    {t(`dr.pay.${s.paymentStatus}`)}
                  </Text>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
