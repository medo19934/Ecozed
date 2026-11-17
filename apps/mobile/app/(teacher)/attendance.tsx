import type { RosterResponse, RosterRow } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { QrCode } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ChildPhoto } from '@/components/child-row';
import { GeoCheck } from '@/components/geo-check';
import { ScreenHeader } from '@/components/screen-header';
import { StatusPill } from '@/components/status-pill';
import { Card, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { timeOf, useMyDay } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/use-api-error';

function Action({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-10 justify-center rounded-xl px-3 ${primary ? 'bg-brand' : 'border border-line bg-white'}`}
    >
      <Text className={`text-sm font-semibold ${primary ? 'text-white' : 'text-ink'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TeacherAttendance() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const apiError = useApiError();
  const { user } = useAuth();
  const day = useMyDay();
  const canManage = Boolean(user?.permissions.includes('canManageAttendance'));
  const roster = useQuery({
    queryKey: ['attendance', 'roster', 'mine'],
    queryFn: () => api.get<RosterResponse>('/attendance/children'),
    refetchInterval: 30_000,
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post<RosterRow>(`/attendance/children/${id}`, { action }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attendance'] }),
    onError: (e) => Alert.alert(apiError(e)),
  });
  const s = day.data?.staff;

  return (
    <Screen>
      <ScreenHeader title={t('tabs.attendance')} subtitle={day.data?.date} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={roster.isRefetching}
            onRefresh={() => void Promise.all([roster.refetch(), day.refetch()])}
          />
        }
      >
        <Card className="gap-3">
          <Text className="text-start text-base font-semibold text-ink">{t('att.myDay')}</Text>
          <Text className="text-start text-sm text-ink-muted">
            {s?.checkInAt
              ? [
                  t('att.in', { time: timeOf(s.checkInAt, i18n.language) }),
                  s.checkOutAt ? t('att.out', { time: timeOf(s.checkOutAt, i18n.language) }) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : t('att.notYet')}
          </Text>
          <GeoCheck />
          {day.data?.kioskEnabled && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/scan')}
              className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-white"
            >
              <QrCode color="#5b6db4" size={20} />
              <Text className="text-base font-semibold text-brand">{t('att.scan')}</Text>
            </Pressable>
          )}
        </Card>

        <Text className="mt-2 text-start text-base font-semibold text-ink">{t('att.roster')}</Text>
        {!canManage && (
          <Text className="text-start text-xs text-ink-muted">{t('att.readOnly')}</Text>
        )}
        {roster.isLoading ? (
          <ActivityIndicator color="#5b6db4" />
        ) : roster.data?.rows.length ? (
          roster.data.rows.map((r) => (
            <View key={r.child.id} className="gap-3 rounded-3xl border border-line bg-white p-4">
              <View className="flex-row items-center gap-3">
                <ChildPhoto
                  path={r.child.hasPhoto ? `/children/${r.child.id}/photo` : null}
                  gender={r.child.gender}
                  size={44}
                />
                <View className="flex-1 gap-0.5">
                  <Text className="text-start text-base font-semibold text-ink">
                    {r.child.fullName}
                  </Text>
                  <Text className="text-start text-xs text-ink-muted">
                    {[
                      r.checkInAt && t('att.in', { time: timeOf(r.checkInAt, i18n.language) }),
                      r.checkOutAt && t('att.out', { time: timeOf(r.checkOutAt, i18n.language) }),
                    ]
                      .filter(Boolean)
                      .join(' · ') || r.child.classroom?.name}
                  </Text>
                </View>
                <StatusPill status={r.status} />
              </View>
              {canManage && r.status !== 'DEPARTURE' && (
                <View className="flex-row flex-wrap gap-2">
                  {r.status === 'ATTENDED' ? (
                    <Action
                      primary
                      label={t('att.checkOut')}
                      onPress={() => act.mutate({ id: r.child.id, action: 'CHECK_OUT' })}
                    />
                  ) : (
                    <Action
                      primary
                      label={t('att.checkIn')}
                      onPress={() => act.mutate({ id: r.child.id, action: 'CHECK_IN' })}
                    />
                  )}
                  {r.status !== 'ABSENT' && r.status !== 'ATTENDED' && (
                    <Action
                      label={t('att.absent')}
                      onPress={() => act.mutate({ id: r.child.id, action: 'ABSENT' })}
                    />
                  )}
                </View>
              )}
            </View>
          ))
        ) : (
          <Card>
            <Text className="text-start text-sm text-ink-muted">{t('home.noClassChildren')}</Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
