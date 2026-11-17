import type { MessageContacts, MessageDto, ThreadDto, ThreadMessages } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  CheckCheck,
  Megaphone,
  Paperclip,
  Plus,
  SendHorizontal,
  Users,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/use-api-error';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';

const POLL_MS = 4000;
const time = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
    sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' },
  ).format(d);
};

function ThreadAvatar({ thread }: { thread: ThreadDto }) {
  const Icon = thread.kind === 'ANNOUNCEMENT' ? Megaphone : thread.kind === 'STAFF' ? Users : null;
  return (
    <View
      className={`h-12 w-12 items-center justify-center rounded-full ${thread.kind === 'ANNOUNCEMENT' ? 'bg-amber-100' : 'bg-brand-soft'}`}
    >
      {Icon ? (
        <Icon color={thread.kind === 'ANNOUNCEMENT' ? '#b45309' : '#5b6db4'} size={22} />
      ) : (
        <Text className="text-lg font-bold text-brand">{thread.title.slice(0, 1)}</Text>
      )}
    </View>
  );
}

/** Parent + teacher inbox: per-child threads, staff chats, announcements (polling). */
export function MessagesScreen() {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  const threads = useQuery({
    queryKey: ['messages', 'threads'],
    queryFn: () => api.get<ThreadDto[]>('/messages/threads'),
    refetchInterval: POLL_MS,
  });
  const contacts = useQuery({
    queryKey: ['messages', 'contacts'],
    queryFn: () => api.get<MessageContacts>('/messages/contacts'),
  });
  const qc = useQueryClient();
  const apiError = useApiError();
  const [error, setError] = useState<string>();
  const start = useMutation({
    mutationFn: (childId: string) =>
      api.post<ThreadDto>('/messages/threads', { kind: 'CHILD', childId }),
    onSuccess: (th) => {
      void qc.invalidateQueries({ queryKey: ['messages', 'threads'] });
      setActive(th.id);
    },
    onError: (e) => setError(apiError(e)),
  });

  if (active) return <Chat id={active} onBack={() => setActive(null)} />;
  const list = threads.data ?? [];
  const withThread = new Set(list.map((x) => x.child?.id).filter(Boolean));
  const fresh = (contacts.data?.children ?? []).filter((c) => !withThread.has(c.id));

  return (
    <Screen>
      <ScreenHeader title={t('tabs.messages')} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={threads.isRefetching}
            onRefresh={() => void threads.refetch()}
          />
        }
      >
        {threads.isPending ? (
          <ActivityIndicator color="#5b6db4" />
        ) : list.length === 0 && fresh.length === 0 ? (
          <Card className="items-center py-10">
            <Text className="text-base text-ink-muted">{t('msg.empty')}</Text>
          </Card>
        ) : (
          list.map((th) => (
            <Pressable key={th.id} accessibilityRole="button" onPress={() => setActive(th.id)}>
              <Card className="flex-row items-center gap-3">
                <ThreadAvatar thread={th} />
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-start text-base font-semibold text-ink"
                    >
                      {th.title}
                    </Text>
                    {th.lastMessage && (
                      <Text className="text-xs text-ink-muted">{time(th.lastMessage.at)}</Text>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text numberOfLines={1} className="flex-1 text-start text-sm text-ink-muted">
                      {th.lastMessage
                        ? `${th.lastMessage.senderName}: ${th.lastMessage.body ?? t('msg.attachment')}`
                        : (th.subtitle ?? t('msg.noMessages'))}
                    </Text>
                    {th.unread > 0 && (
                      <View className="min-w-5 items-center rounded-full bg-brand px-1.5">
                        <Text className="text-xs font-bold text-white">{th.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}
        {fresh.length > 0 && (
          <View className="mt-2 gap-2">
            <Text className="text-start text-sm font-semibold text-ink-muted">
              {t('msg.newChat')}
            </Text>
            {fresh.slice(0, 20).map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                disabled={start.isPending}
                onPress={() => start.mutate(c.id)}
                className="min-h-12 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4"
              >
                <Plus color="#5b6db4" size={18} />
                <Text className="flex-1 text-start text-base text-ink">{c.fullName}</Text>
                {c.classroom ? <Text className="text-xs text-ink-muted">{c.classroom}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
        {error ? <Text className="text-start text-sm text-danger">{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function Chat({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const apiError = useApiError();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const listRef = useRef<FlatList<MessageDto>>(null);
  const q = useQuery({
    queryKey: ['messages', 'thread', id],
    queryFn: () => api.get<ThreadMessages>(`/messages/threads/${id}`),
    refetchInterval: POLL_MS,
  });
  const count = q.data?.messages.length ?? 0;
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [count]);
  const send = useMutation({
    mutationFn: () => api.post<MessageDto>(`/messages/threads/${id}`, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      setError(undefined);
      void qc.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (e) => setError(apiError(e)),
  });
  const thread = q.data?.thread;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-row items-center gap-3 border-b border-line bg-white px-3 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('msg.back')}
          onPress={onBack}
          className="h-11 w-11 items-center justify-center"
        >
          <ArrowRight
            color="#1f2433"
            size={22}
            style={{ transform: [{ scaleX: i18n.language === 'ar' ? 1 : -1 }] }}
          />
        </Pressable>
        {thread && <ThreadAvatar thread={thread} />}
        <View className="flex-1">
          <Text numberOfLines={1} className="text-start text-base font-semibold text-ink">
            {thread?.title ?? ''}
          </Text>
          {thread && (
            <Text numberOfLines={1} className="text-start text-xs text-ink-muted">
              {[t(`msg.kinds.${thread.kind}`), thread.subtitle, thread.branch.name]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
        </View>
      </View>
      {q.isPending ? (
        <ActivityIndicator className="mt-10" color="#5b6db4" />
      ) : (
        <FlatList
          ref={listRef}
          data={q.data?.messages ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-ink-muted">{t('msg.noMessages')}</Text>
          }
          renderItem={({ item: m }) => (
            <View
              className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${m.mine ? 'self-start bg-brand' : 'self-end bg-white'}`}
            >
              {!m.mine && (
                <Text className="mb-0.5 text-start text-xs font-semibold text-brand">
                  {m.sender.fullName}
                </Text>
              )}
              {m.body ? (
                <Text className={`text-start text-base ${m.mine ? 'text-white' : 'text-ink'}`}>
                  {m.body}
                </Text>
              ) : null}
              {m.attachment && (
                <View className="mt-1 flex-row items-center gap-1.5">
                  <Paperclip color={m.mine ? '#fff' : '#5b6db4'} size={14} />
                  <Text className={`text-sm ${m.mine ? 'text-white' : 'text-brand'}`}>
                    {m.attachment.name}
                  </Text>
                </View>
              )}
              <View className="mt-1 flex-row items-center gap-1">
                <Text className={`text-[11px] ${m.mine ? 'text-white/75' : 'text-ink-muted'}`}>
                  {time(m.createdAt)}
                </Text>
                {m.mine &&
                  (m.read ? (
                    <CheckCheck color="#fff" size={13} />
                  ) : (
                    <Check color="#fff" size={13} />
                  ))}
              </View>
            </View>
          )}
        />
      )}
      {error ? <Text className="px-4 text-start text-sm text-danger">{error}</Text> : null}
      {thread?.canPost === false ? (
        <Text
          className="border-t border-line bg-white p-4 text-center text-sm text-ink-muted"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {t('msg.readOnly')}
        </Text>
      ) : (
        <View
          className="flex-row items-end gap-2 border-t border-line bg-white p-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t('msg.placeholder')}
            placeholderTextColor="#9a9ab0"
            multiline
            maxLength={4000}
            className="max-h-32 min-h-12 flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-start text-base text-ink"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('msg.send')}
            disabled={!body.trim() || send.isPending}
            onPress={() => send.mutate()}
            className={`h-12 w-12 items-center justify-center rounded-full ${body.trim() ? 'bg-brand' : 'bg-line'}`}
          >
            <SendHorizontal
              color="#fff"
              size={20}
              style={{ transform: [{ scaleX: i18n.language === 'ar' ? -1 : 1 }] }}
            />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
