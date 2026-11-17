import type { ChildListItem, Paginated } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, Text } from 'react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFormatAge } from '@/lib/use-age';
import { ChildRow } from './child-row';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';
import { WeekStrip } from './week-strip';

/** Teacher "Today": children of the teacher's classes (scope enforced by the API). */
export function TeacherHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const age = useFormatAge();
  const branch = user?.memberships.find((m) => m.daycareId === user.daycareId)?.daycareName;
  const kids = useQuery({
    queryKey: ['children', 'mine'],
    queryFn: () => api.get<Paginated<ChildListItem>>('/children?pageSize=100'),
  });
  return (
    <Screen>
      <ScreenHeader title={t('home.hello', { name: user?.fullName ?? '' })} subtitle={branch} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={kids.isRefetching} onRefresh={() => void kids.refetch()} />
        }
      >
        <WeekStrip />
        <Text className="mt-2 text-start text-base font-semibold text-ink">
          {t('home.myClass')}
        </Text>
        {kids.isLoading ? (
          <ActivityIndicator color="#5b6db4" />
        ) : kids.data?.items.length ? (
          kids.data.items.map((k) => (
            <ChildRow
              key={k.id}
              onPress={() => router.push(`/child/${k.id}`)}
              photoPath={k.hasPhoto ? `/children/${k.id}/photo` : null}
              gender={k.gender}
              name={k.fullName}
              lines={[age(k.birthDate), k.classroom?.name]}
            />
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
