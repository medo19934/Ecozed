import type { AdmissionDto, AdmissionListResponse, ClassroomDto } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
import { StackHeader } from '@/components/stack-header';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/use-api-error';

const TONE = {
  UNDER_REVIEW: 'text-warning',
  ACCEPTED: 'text-success',
  REJECTED: 'text-danger',
} as const;

/** Admission requests (manager / enrollment permission): same API and rules as the web table. */
export default function AdmissionsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const apiError = useApiError();
  const [status, setStatus] = useState<'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | ''>(
    'UNDER_REVIEW',
  );
  const [open, setOpen] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['admissions', 'm', status],
    queryFn: () =>
      api.get<AdmissionListResponse>(`/admissions?pageSize=50${status ? `&status=${status}` : ''}`),
  });
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassroomDto[]>('/classes'),
  });
  const act = useMutation({
    mutationFn: ({ a, accept }: { a: AdmissionDto; accept: boolean }) =>
      accept
        ? api.post(`/admissions/${a.id}/accept`, { classroomId: classId })
        : api.post(`/admissions/${a.id}/reject`, { reason: t('menu.rejectReason') }),
    onSuccess: () => {
      setOpen(null);
      void qc.invalidateQueries({ queryKey: ['admissions'] });
    },
    onError: (e) => Alert.alert(apiError(e)),
  });
  const c = q.data?.counts;
  return (
    <View className="flex-1 bg-surface">
      <StackHeader title={t('menu.admissions')} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        }
      >
        <View className="flex-row flex-wrap gap-2">
          {(['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', ''] as const).map((s) => (
            <Pressable
              key={s || 'all'}
              onPress={() => setStatus(s)}
              className={`min-h-10 justify-center rounded-full border px-4 ${status === s ? 'border-brand bg-brand' : 'border-line bg-white'}`}
            >
              <Text className={status === s ? 'text-white' : 'text-ink'}>
                {t(`menu.adm.${s || 'ALL'}`)} {c ? `(${s ? c[s] : c.total})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        {q.isPending ? (
          <ActivityIndicator color="#5b6db4" />
        ) : (q.data?.items ?? []).length === 0 ? (
          <Card>
            <Text className="text-start text-sm text-ink-muted">{t('menu.empty')}</Text>
          </Card>
        ) : (
          q.data!.items.map((a) => (
            <Card key={a.id} className="gap-2">
              <Pressable onPress={() => setOpen(open === a.id ? null : a.id)} className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-start text-base font-semibold text-ink">
                    #{a.number} · {a.childName}
                  </Text>
                  <Text className={`text-sm font-semibold ${TONE[a.status]}`}>
                    {t(`menu.adm.${a.status}`)}
                  </Text>
                </View>
                <Text className="text-start text-sm text-ink-muted">
                  {a.guardianName} · {a.phone ?? a.email ?? ''} · {a.createdAt.slice(0, 10)}
                </Text>
              </Pressable>
              {open === a.id && a.status === 'UNDER_REVIEW' && (
                <View className="gap-2">
                  <Text className="text-start text-sm font-medium text-ink">
                    {t('menu.assignClass')}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(classes.data ?? []).map((cl) => (
                      <Pressable
                        key={cl.id}
                        onPress={() => setClassId(cl.id)}
                        className={`min-h-9 justify-center rounded-full border px-3 ${classId === cl.id ? 'border-brand bg-brand' : 'border-line bg-white'}`}
                      >
                        <Text className={classId === cl.id ? 'text-white' : 'text-ink'}>
                          {cl.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      disabled={act.isPending}
                      onPress={() => act.mutate({ a, accept: true })}
                      className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-success"
                    >
                      <Text className="font-semibold text-white">{t('menu.accept')}</Text>
                    </Pressable>
                    <Pressable
                      disabled={act.isPending}
                      onPress={() => act.mutate({ a, accept: false })}
                      className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-danger"
                    >
                      <Text className="font-semibold text-white">{t('menu.reject')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
