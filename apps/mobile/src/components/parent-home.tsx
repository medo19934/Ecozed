import type { ParentChildDto } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Baby, QrCode, Umbrella } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { timeOf, useMyDay } from '@/lib/attendance';
import { StatusPill } from './status-pill';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFormatAge } from '@/lib/use-age';
import { ChildRow } from './child-row';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';
import { WeekStrip } from './week-strip';

export function ParentHome() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const day = useMyDay();
  const { user } = useAuth();
  const age = useFormatAge();
  const kids = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => api.get<ParentChildDto[]>('/parent/children'),
  });

  return (
    <Screen>
      <ScreenHeader
        title={t('home.hello', { name: user?.fullName ?? '' })}
        subtitle={t('home.parentIntro')}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={kids.isRefetching} onRefresh={() => void kids.refetch()} />
        }
      >
        {!!kids.data?.length && (
          <View className="flex-row gap-3">
            {day.data?.kioskEnabled && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/scan')}
                className="min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-brand"
              >
                <QrCode color="#fff" size={20} />
                <Text className="text-sm font-semibold text-white">{t('att.scan')}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/vacation')}
              className="min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-white"
            >
              <Umbrella color="#5b6db4" size={20} />
              <Text className="text-sm font-semibold text-brand">{t('att.vacation')}</Text>
            </Pressable>
          </View>
        )}
        <Text className="text-start text-base font-semibold text-ink">{t('home.myChildren')}</Text>
        {kids.isLoading ? (
          <ActivityIndicator color="#5b6db4" />
        ) : kids.data?.length ? (
          kids.data.map((k) => {
            const today = day.data?.children.find((c) => c.id === k.id);
            return (
              <ChildRow
                key={k.id}
                badge={today ? <StatusPill status={today.status} /> : undefined}
                photoPath={k.hasPhoto ? `/parent/children/${k.id}/photo` : null}
                gender={k.gender}
                name={k.fullName}
                lines={[
                  age(k.birthDate),
                  `${(i18n.language === 'en' && k.branch.nameEn) || k.branch.name} · ${k.classroom?.name ?? t('home.noClass')}`,
                  today?.checkInAt
                    ? [
                        t('att.in', { time: timeOf(today.checkInAt, i18n.language) }),
                        today.checkOutAt
                          ? t('att.out', { time: timeOf(today.checkOutAt, i18n.language) })
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : null,
                ]}
              />
            );
          })
        ) : (
          <Card>
            <Text className="text-start text-sm leading-5 text-ink-muted">
              {t('home.noChildren')}
            </Text>
          </Card>
        )}

        <Text className="text-start text-base font-semibold text-ink">{t('home.thisWeek')}</Text>
        <WeekStrip />
        <Card className="flex-row items-start gap-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
            <Baby color="#5b6db4" size={24} />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-start text-base font-semibold text-ink">
                {t('home.enrollTitle')}
              </Text>
              <Text className="rounded-full bg-line px-2 py-0.5 text-[11px] text-ink-muted">
                {t('common.soon')}
              </Text>
            </View>
            <Text className="text-start text-sm leading-5 text-ink-muted">
              {t('home.enrollBody')}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
