import type { MessageContacts, MessageDto, ThreadDto, ThreadMessages } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Mic,
  Pause,
  Play,
  Plus,
  SendHorizontal,
  Square,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/use-api-error';
import { ScreenHeader } from './screen-header';
import { Card, Field, PrimaryButton, Screen } from './ui';

const POLL_MS = 4000;
const rtl = () => i18n.language === 'ar';
const time = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    rtl() ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
    sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' },
  ).format(d);
};
const fileUrl = (path: string) => `${API_URL}${path}`;

/** Unread total for the tab badge. */
export function useUnreadMessages(enabled = true) {
  const q = useQuery({
    queryKey: ['messages', 'unread'],
    queryFn: () => api.get<{ unread: number }>('/messages/unread'),
    refetchInterval: 15_000,
    enabled,
  });
  return q.data?.unread ?? 0;
}

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
  const [composeOpen, setComposeOpen] = useState(false);
  const threads = useQuery({
    queryKey: ['messages', 'threads'],
    queryFn: () => api.get<ThreadDto[]>('/messages/threads'),
    refetchInterval: POLL_MS,
  });

  if (active) return <Chat id={active} onBack={() => setActive(null)} />;
  const list = threads.data ?? [];

  return (
    <Screen>
      <ScreenHeader title={t('tabs.messages')} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={threads.isRefetching}
            onRefresh={() => void threads.refetch()}
          />
        }
      >
        {threads.isPending ? (
          <ActivityIndicator color="#5b6db4" />
        ) : list.length === 0 ? (
          <Card className="items-center gap-3 py-10">
            <Text className="text-base text-ink-muted">{t('msg.empty')}</Text>
            <PrimaryButton label={t('msg.new')} onPress={() => setComposeOpen(true)} />
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
                      <View className="min-w-6 items-center rounded-full bg-brand px-1.5 py-0.5">
                        <Text className="text-xs font-bold text-white">{th.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('msg.new')}
        onPress={() => setComposeOpen(true)}
        className="absolute bottom-6 end-6 h-14 w-14 items-center justify-center rounded-full bg-brand shadow-lg"
      >
        <Plus color="#fff" size={26} />
      </Pressable>
      <NewConversation
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onOpened={(id) => {
          setComposeOpen(false);
          setActive(id);
        }}
      />
    </Screen>
  );
}

function NewConversation({
  open,
  onClose,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const apiError = useApiError();
  const [kind, setKind] = useState<'CHILD' | 'STAFF' | 'ANNOUNCEMENT'>('CHILD');
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState<string | undefined>();
  const [error, setError] = useState<string>();
  const contacts = useQuery({
    queryKey: ['messages', 'contacts'],
    queryFn: () => api.get<MessageContacts>('/messages/contacts'),
    enabled: open,
  });
  const c = contacts.data;
  const start = useMutation({
    mutationFn: (body: unknown) => api.post<ThreadDto>('/messages/threads', body),
    onSuccess: (th) => {
      void qc.invalidateQueries({ queryKey: ['messages', 'threads'] });
      setTitle('');
      onOpened(th.id);
    },
    onError: (e) => setError(apiError(e)),
  });
  const kinds = [
    'CHILD' as const,
    ...(c && c.staff.length ? (['STAFF'] as const) : []),
    ...(c?.canAnnounce ? (['ANNOUNCEMENT'] as const) : []),
  ];
  const Row = ({
    label,
    sub,
    onPress,
  }: {
    label: string;
    sub?: string | null;
    onPress: () => void;
  }) => (
    <Pressable
      accessibilityRole="button"
      disabled={start.isPending}
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4"
    >
      <Text className="flex-1 text-start text-base text-ink">{label}</Text>
      {sub ? <Text className="text-xs text-ink-muted">{sub}</Text> : null}
    </Pressable>
  );

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="max-h-[85%] rounded-t-3xl bg-surface"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="flex-row items-center justify-between p-5">
            <Text className="text-lg font-bold text-ink">{t('msg.new')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('att.close')}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center"
            >
              <X color="#1f2433" size={22} />
            </Pressable>
          </View>
          {kinds.length > 1 && (
            <View className="mx-5 mb-3 flex-row gap-1 rounded-2xl bg-white p-1">
              {kinds.map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="tab"
                  onPress={() => setKind(k)}
                  className={`min-h-10 flex-1 items-center justify-center rounded-xl ${kind === k ? 'bg-brand' : ''}`}
                >
                  <Text
                    className={`text-sm ${kind === k ? 'font-semibold text-white' : 'text-ink-muted'}`}
                  >
                    {t(`msg.kinds.${k}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {!c ? (
              <ActivityIndicator color="#5b6db4" />
            ) : kind === 'CHILD' ? (
              c.children.length === 0 ? (
                <Text className="text-center text-ink-muted">{t('msg.noChildren')}</Text>
              ) : (
                c.children.map((x) => (
                  <Row
                    key={x.id}
                    label={x.fullName}
                    sub={x.classroom}
                    onPress={() => start.mutate({ kind: 'CHILD', childId: x.id })}
                  />
                ))
              )
            ) : kind === 'STAFF' ? (
              c.staff.map((x) => (
                <Row
                  key={x.userId}
                  label={x.fullName}
                  onPress={() => start.mutate({ kind: 'STAFF', userId: x.userId })}
                />
              ))
            ) : (
              <View className="gap-3">
                <Field
                  label={t('msg.announcementTitle')}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                />
                <Text className="text-start text-sm font-medium text-ink">{t('msg.audience')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[{ id: undefined, name: t('msg.wholeBranch') }, ...c.classes].map((x) => (
                    <Pressable
                      key={x.id ?? 'all'}
                      onPress={() => setClassId(x.id)}
                      className={`min-h-10 justify-center rounded-full border px-4 ${classId === x.id ? 'border-brand bg-brand' : 'border-line bg-white'}`}
                    >
                      <Text className={classId === x.id ? 'text-white' : 'text-ink'}>{x.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <PrimaryButton
                  label={t('msg.start')}
                  loading={start.isPending}
                  onPress={() =>
                    title.trim() &&
                    start.mutate({
                      kind: 'ANNOUNCEMENT',
                      title: title.trim(),
                      classroomId: classId,
                    })
                  }
                />
              </View>
            )}
            {error ? <Text className="text-start text-sm text-danger">{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function VoiceNote({ url, mine }: { url: string; mine: boolean }) {
  const player = useAudioPlayer({ uri: fileUrl(url) });
  const status = useAudioPlayerStatus(player);
  const color = mine ? '#fff' : '#5b6db4';
  const total = Math.max(1, status.duration || 0);
  const pos = status.currentTime || 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <View className="mt-1 w-56 flex-row items-center gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (status.playing) player.pause();
          else {
            if (status.didJustFinish || pos >= total - 0.2) void player.seekTo(0);
            player.play();
          }
        }}
        className={`h-10 w-10 items-center justify-center rounded-full ${mine ? 'bg-white/20' : 'bg-brand-soft'}`}
      >
        {status.playing ? <Pause color={color} size={18} /> : <Play color={color} size={18} />}
      </Pressable>
      <View
        className={`h-1.5 flex-1 overflow-hidden rounded-full ${mine ? 'bg-white/30' : 'bg-line'}`}
      >
        <View
          className={mine ? 'h-full bg-white' : 'h-full bg-brand'}
          style={{ width: `${Math.min(100, (pos / total) * 100)}%` }}
        />
      </View>
      <Text className={`text-xs ${mine ? 'text-white/80' : 'text-ink-muted'}`}>
        {fmt(status.playing ? pos : status.duration || 0)}
      </Text>
    </View>
  );
}

function Chat({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const apiError = useApiError();
  const { user } = useAuth();
  const isStaff = user?.role !== 'PARENT';
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const [attachOpen, setAttachOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recSeconds, setRecSeconds] = useState<number | null>(null);
  const listRef = useRef<FlatList<MessageDto>>(null);
  const q = useQuery({
    queryKey: ['messages', 'thread', id],
    queryFn: () => api.get<ThreadMessages>(`/messages/threads/${id}`),
    refetchInterval: POLL_MS,
  });
  const count = q.data?.messages.length ?? 0;
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    void qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
  }, [count, qc]);
  useEffect(() => {
    if (recSeconds === null) return;
    const timer = setInterval(() => setRecSeconds((s) => (s === null ? s : s + 1)), 1000);
    return () => clearInterval(timer);
  }, [recSeconds === null]);

  const send = useMutation({
    mutationFn: (file?: { uri: string; name: string; type: string }) =>
      file
        ? api.upload<MessageDto>(
            `/messages/threads/${id}`,
            file,
            body.trim() && !file.type.startsWith('audio/') ? { body: body.trim() } : {},
          )
        : api.post<MessageDto>(`/messages/threads/${id}`, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      setError(undefined);
      void qc.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (e) => setError(apiError(e)),
  });

  const pickImage = async (camera: boolean) => {
    setAttachOpen(false);
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(t('msg.permissionDenied'));
    const r = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const a = r.assets?.[0];
    if (r.canceled || !a) return;
    const type = a.mimeType ?? 'image/jpeg';
    send.mutate({ uri: a.uri, name: a.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`, type });
  };
  const pickFile = async () => {
    setAttachOpen(false);
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const a = r.assets?.[0];
    if (r.canceled || !a) return;
    send.mutate({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' });
  };
  const toggleRecord = async () => {
    if (recSeconds !== null) {
      await recorder.stop();
      setRecSeconds(null);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) send.mutate({ uri: recorder.uri, name: 'voice.m4a', type: 'audio/mp4' });
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return setError(t('msg.permissionDenied'));
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecSeconds(0);
  };

  const thread = q.data?.thread;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            style={{ transform: [{ scaleX: rtl() ? 1 : -1 }] }}
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
          renderItem={({ item: m }) => {
            const a = m.attachment;
            return (
              <View
                className={`max-w-[82%] rounded-2xl px-3 py-2.5 ${m.mine ? 'self-start bg-brand' : 'self-end bg-white'}`}
              >
                {!m.mine && (
                  <Text className="mb-0.5 text-start text-xs font-semibold text-brand">
                    {m.sender.fullName}
                  </Text>
                )}
                {a?.mime.startsWith('image/') ? (
                  <Pressable onPress={() => setViewer(fileUrl(a.url))}>
                    <Image
                      source={{ uri: fileUrl(a.url) }}
                      style={{ width: 220, height: 220, borderRadius: 14 }}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : a?.mime.startsWith('audio/') ? (
                  <VoiceNote url={a.url} mine={m.mine} />
                ) : a ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(fileUrl(a.url))}
                    className={`mt-1 min-h-11 flex-row items-center gap-2 rounded-xl px-3 ${m.mine ? 'bg-white/15' : 'bg-surface'}`}
                  >
                    <FileText color={m.mine ? '#fff' : '#5b6db4'} size={18} />
                    <Text
                      numberOfLines={1}
                      className={`flex-1 text-sm underline ${m.mine ? 'text-white' : 'text-brand'}`}
                    >
                      {a.name}
                    </Text>
                  </Pressable>
                ) : null}
                {m.body ? (
                  <Text
                    className={`mt-0.5 text-start text-base ${m.mine ? 'text-white' : 'text-ink'}`}
                  >
                    {m.body}
                  </Text>
                ) : null}
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
            );
          }}
        />
      )}
      {error ? <Text className="px-4 pb-1 text-start text-sm text-danger">{error}</Text> : null}
      {thread?.canPost === false ? (
        <Text
          className="border-t border-line bg-white p-4 text-center text-sm text-ink-muted"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {t('msg.readOnly')}
        </Text>
      ) : (
        <View
          className="border-t border-line bg-white"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {isStaff && !body && recSeconds === null && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 8 }}
            >
              {[0, 1, 2, 3].map((i) => (
                <Pressable
                  key={i}
                  onPress={() => setBody(t(`msg.quick.${i}`))}
                  className="min-h-9 justify-center rounded-full border border-line px-3"
                >
                  <Text className="text-xs text-ink-muted">{t(`msg.quick.${i}`)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {attachOpen && (
            <View className="flex-row gap-2 px-3 pt-2">
              {[
                { icon: Camera, label: t('msg.camera'), on: () => void pickImage(true) },
                { icon: ImageIcon, label: t('msg.photo'), on: () => void pickImage(false) },
                { icon: FileText, label: t('msg.file'), on: () => void pickFile() },
              ].map(({ icon: Icon, label, on }) => (
                <Pressable
                  key={label}
                  onPress={on}
                  className="min-h-16 flex-1 items-center justify-center gap-1 rounded-2xl bg-surface"
                >
                  <Icon color="#5b6db4" size={22} />
                  <Text className="text-xs text-ink">{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View className="flex-row items-end gap-2 p-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('msg.attach')}
              disabled={recSeconds !== null}
              onPress={() => setAttachOpen((v) => !v)}
              className="h-12 w-12 items-center justify-center rounded-full bg-surface"
            >
              {attachOpen ? <X color="#5b6db4" size={22} /> : <Plus color="#5b6db4" size={22} />}
            </Pressable>
            {recSeconds !== null ? (
              <View className="min-h-12 flex-1 flex-row items-center gap-2 rounded-2xl bg-red-50 px-4">
                <View className="h-2.5 w-2.5 rounded-full bg-danger" />
                <Text className="text-base text-danger">
                  {t('msg.recording', { s: recSeconds })}
                </Text>
              </View>
            ) : (
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={t('msg.placeholder')}
                placeholderTextColor="#9a9ab0"
                multiline
                maxLength={4000}
                className="max-h-32 min-h-12 flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-start text-base text-ink"
              />
            )}
            {send.isPending ? (
              <View className="h-12 w-12 items-center justify-center">
                <ActivityIndicator color="#5b6db4" />
              </View>
            ) : body.trim() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('msg.send')}
                onPress={() => send.mutate(undefined)}
                className="h-12 w-12 items-center justify-center rounded-full bg-brand"
              >
                <SendHorizontal
                  color="#fff"
                  size={20}
                  style={{ transform: [{ scaleX: rtl() ? -1 : 1 }] }}
                />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recSeconds !== null ? t('msg.stopRecording') : t('msg.record')}
                onPress={() => void toggleRecord()}
                className={`h-12 w-12 items-center justify-center rounded-full ${recSeconds !== null ? 'bg-danger' : 'bg-brand'}`}
              >
                {recSeconds !== null ? (
                  <Square color="#fff" size={18} />
                ) : (
                  <Mic color="#fff" size={20} />
                )}
              </Pressable>
            )}
          </View>
        </View>
      )}
      <Modal
        visible={!!viewer}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/90"
          onPress={() => setViewer(null)}
        >
          {viewer && (
            <Image
              source={{ uri: viewer }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
