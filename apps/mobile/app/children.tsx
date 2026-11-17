import type { ChildListItem, Paginated } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { ChildRow } from '@/components/child-row';
import { StackHeader } from '@/components/stack-header';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatAge } from '@/lib/use-age';

/** Children list (same API + role scope as the web: teachers see their classes only). */
export default function ChildrenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const age = useFormatAge();
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['children', 'list', search],
    queryFn: () =>
      api.get<Paginated<ChildListItem>>(
        `/children?pageSize=100&status=ACTIVE${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
  return (
    <View className="flex-1 bg-surface">
      <StackHeader title={t('menu.children')} />
      <View className="px-5 pt-4">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('menu.searchChild')}
          placeholderTextColor="#9a9ab0"
          className="min-h-12 rounded-2xl border border-line bg-white px-4 text-start text-base text-ink"
        />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        }
      >
        {q.isPending ? (
          <ActivityIndicator color="#5b6db4" />
        ) : (q.data?.items ?? []).length === 0 ? (
          <Card>
            <Text className="text-start text-sm text-ink-muted">{t('menu.empty')}</Text>
          </Card>
        ) : (
          q.data!.items.map((k) => (
            <ChildRow
              key={k.id}
              onPress={() => router.push(`/child/${k.id}`)}
              photoPath={k.hasPhoto ? `/children/${k.id}/photo` : null}
              gender={k.gender}
              name={k.fullName}
              lines={[
                age(k.birthDate),
                k.classroom?.name,
                k.primaryGuardian
                  ? `${k.primaryGuardian.fullName} · ${k.primaryGuardian.phone ?? ''}`
                  : null,
              ]}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
