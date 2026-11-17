import type { SubscriptionDto, SubscriptionListResponse } from '@latif/shared';
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
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/use-api-error';

const sar = (n: number) =>
  new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(n);

/** Subscriptions (manager / payments permission): same API and rules as the web page. */
export default function SubscriptionsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const apiError = useApiError();
  const [filter, setFilter] = useState<'' | 'PAID' | 'UNPAID'>('UNPAID');
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['subscriptions', 'm', filter],
    queryFn: () =>
      api.get<SubscriptionListResponse>(
        `/subscriptions?pageSize=50${filter ? `&paymentStatus=${filter}` : ''}`,
      ),
  });
  const act = useMutation({
    mutationFn: ({
      s,
      action,
      method,
    }: {
      s: SubscriptionDto;
      action: 'paid' | 'remind';
      method?: string;
    }) =>
      api.post(
        `/subscriptions/${s.id}/${action}`,
        action === 'paid' ? { paymentMethod: method } : undefined,
      ),
    onSuccess: (_d, v) => {
      setOpen(null);
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      Alert.alert(t(v.action === 'paid' ? 'menu.paidDone' : 'menu.remindDone'));
    },
    onError: (e) => Alert.alert(apiError(e)),
  });
  const s = q.data?.summary;
  return (
    <View className="flex-1 bg-surface">
      <StackHeader title={t('menu.subscriptions')} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        }
      >
        {s && (
          <View className="flex-row gap-2">
            {[
              [t('menu.subTotal'), s.total, 'text-ink'],
              [t('dr.pay.PAID'), s.paid, 'text-success'],
              [t('dr.pay.UNPAID'), s.unpaid, 'text-danger'],
            ].map(([label, n, tone]) => (
              <Card key={String(label)} className="flex-1 items-center gap-1">
                <Text className={`text-2xl font-bold ${tone}`}>{n}</Text>
                <Text className="text-center text-xs text-ink-muted">{label}</Text>
              </Card>
            ))}
          </View>
        )}
        {s && s.unpaidAmount > 0 && (
          <Text className="text-start text-sm text-danger">
            {t('menu.unpaidTotal', { amount: sar(s.unpaidAmount) })}
          </Text>
        )}
        <View className="flex-row gap-2">
          {(['UNPAID', 'PAID', ''] as const).map((f) => (
            <Pressable
              key={f || 'all'}
              onPress={() => setFilter(f)}
              className={`min-h-10 justify-center rounded-full border px-4 ${filter === f ? 'border-brand bg-brand' : 'border-line bg-white'}`}
            >
              <Text className={filter === f ? 'text-white' : 'text-ink'}>
                {f ? t(`dr.pay.${f}`) : t('menu.all')}
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
          q.data!.items.map((x) => {
            const unpaid = x.paymentStatus === 'UNPAID' && x.status !== 'CANCELED';
            return (
              <Card key={x.id} className={`gap-2 ${unpaid ? 'border-danger/40 bg-red-50' : ''}`}>
                <Pressable onPress={() => setOpen(open === x.id ? null : x.id)} className="gap-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-start text-base font-semibold text-ink">
                      {x.child.fullName}
                    </Text>
                    <Text
                      className={
                        unpaid ? 'font-semibold text-danger' : 'font-semibold text-success'
                      }
                    >
                      {t(`dr.pay.${x.paymentStatus}`)}
                    </Text>
                  </View>
                  <Text className="text-start text-sm text-ink-muted">
                    {x.plan?.name ?? ''} · {sar(x.value)} · {x.startDate} → {x.endDate}
                  </Text>
                </Pressable>
                {open === x.id && unpaid && (
                  <View className="gap-2">
                    <View className="flex-row gap-2">
                      {(['CASH', 'CARD', 'TRANSFER'] as const).map((m) => (
                        <Pressable
                          key={m}
                          disabled={act.isPending}
                          onPress={() => act.mutate({ s: x, action: 'paid', method: m })}
                          className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-success"
                        >
                          <Text className="text-center text-sm font-semibold text-white">
                            {t(`menu.method.${m}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      disabled={act.isPending}
                      onPress={() => act.mutate({ s: x, action: 'remind' })}
                      className="min-h-12 items-center justify-center rounded-2xl border border-brand"
                    >
                      <Text className="font-semibold text-brand">{t('menu.remind')}</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
