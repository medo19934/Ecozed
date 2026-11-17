'use client';

import type { MessageDto, ThreadDto, ThreadMessages } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  CheckCheck,
  FileText,
  Megaphone,
  MessageSquare,
  Mic,
  Paperclip,
  Square,
  Plus,
  Search,
  SendHorizontal,
  Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api, fileUrl } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';
import { NewMessageDialog } from './new-message-dialog';

type Tab = 'all' | 'staff' | 'parents';
const POLL_MS = 4000;

function useTime() {
  const locale = useLocale();
  return (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return new Intl.DateTimeFormat(
      locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
      sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' },
    ).format(d);
  };
}

function ThreadIcon({ thread }: { thread: ThreadDto }) {
  if (thread.kind === 'ANNOUNCEMENT')
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
        <Megaphone className="size-5" />
      </span>
    );
  if (thread.kind === 'STAFF')
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <Users className="size-5" />
      </span>
    );
  return (
    <Avatar
      className="size-11"
      name={thread.title}
      src={thread.child?.hasPhoto ? fileUrl(`/children/${thread.child.id}/photo`) : null}
    />
  );
}

export function MessagesView() {
  const t = useTranslations('messages');
  const session = useSession();
  const isParent = session.data?.role === 'PARENT';
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const time = useTime();

  const threads = useQuery({
    queryKey: ['messages', 'threads', tab, search],
    queryFn: () =>
      api.get<ThreadDto[]>(
        `/messages/threads?tab=${tab}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    refetchInterval: POLL_MS,
  });
  const list = threads.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <NewMessageDialog onOpened={(th) => setActive(th.id)}>
          <Button>
            <Plus /> {t('new')}
          </Button>
        </NewMessageDialog>
      </div>
      <div className="grid h-[calc(100dvh-11rem)] min-h-[480px] overflow-hidden rounded-[20px] border bg-card lg:grid-cols-[340px_1fr]">
        <aside className={cn('flex min-h-0 flex-col border-e', active && 'hidden lg:flex')}>
          <div className="grid gap-3 border-b p-3">
            {!isParent && (
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                {(['all', 'staff', 'parents'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={cn(
                      'flex-1 rounded-lg px-2 py-1.5 text-sm',
                      tab === k ? 'bg-card font-semibold shadow-xs' : 'text-muted-foreground',
                    )}
                  >
                    {t(`tabs.${k}`)}
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="ps-9"
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads.isPending ? (
              <div className="grid gap-2 p-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState icon={MessageSquare} title={t('empty')} />
            ) : (
              list.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setActive(th.id)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b px-3 py-3 text-start hover:bg-muted/60',
                    active === th.id && 'bg-secondary',
                  )}
                >
                  <ThreadIcon thread={th} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="flex-1 truncate font-semibold">{th.title}</span>
                      {th.lastMessage && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {time(th.lastMessage.at)}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm text-muted-foreground">
                        {th.lastMessage
                          ? `${th.lastMessage.senderName}: ${th.lastMessage.body ?? t('attachment')}`
                          : (th.subtitle ?? t('noMessages'))}
                      </span>
                      {th.unread > 0 && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                          {th.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className={cn('min-h-0', !active && 'hidden lg:block')}>
          {active ? (
            <Chat key={active} id={active} onBack={() => setActive(null)} />
          ) : (
            <EmptyState icon={MessageSquare} title={t('pick')} />
          )}
        </section>
      </div>
    </div>
  );
}

function Chat({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslations('messages');
  const tr = useTranslations('user.roles');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const time = useTime();
  const [body, setBody] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(0);
  const session = useSession();
  const isStaff = session.data?.role !== 'PARENT';
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecording((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording > 0]);

  const toggleRecord = async () => {
    if (recorder.current) {
      recorder.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type =
        ['audio/webm', 'audio/mp4', 'audio/ogg'].find((x) => MediaRecorder.isTypeSupported(x)) ??
        '';
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        recorder.current = null;
        setRecording(0);
        const mime = (rec.mimeType || 'audio/webm').split(';')[0]!;
        const blob = new Blob(chunks, { type: mime });
        if (blob.size > 0)
          send.mutate(new File([blob], `voice.${mime.split('/')[1]}`, { type: mime }));
      };
      rec.start();
      recorder.current = rec;
      setRecording(1);
    } catch {
      toast.error(t('micDenied'));
    }
  };

  const q = useQuery({
    queryKey: ['messages', 'thread', id],
    queryFn: () => api.get<ThreadMessages>(`/messages/threads/${id}`),
    refetchInterval: POLL_MS,
  });
  const count = q.data?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
    void qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
  }, [count, qc]);

  const send = useMutation({
    mutationFn: (file?: File) =>
      file
        ? api.upload<MessageDto>(
            `/messages/threads/${id}`,
            file,
            body.trim() ? { body: body.trim() } : {},
          )
        : api.post<MessageDto>(`/messages/threads/${id}`, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isPending) return <Skeleton className="m-4 h-64" />;
  if (!q.data) return <EmptyState icon={MessageSquare} title={t('notFound')} />;
  const { thread, messages } = q.data;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b p-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onBack}
          aria-label={t('back')}
        >
          <ArrowRight className="ltr:-scale-x-100" />
        </Button>
        <ThreadIcon thread={thread} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{thread.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[t(`kinds.${thread.kind}`), thread.subtitle, thread.branch.name]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f2f4f5] p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('noMessages')}</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.mine ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 shadow-xs',
                m.mine ? 'bg-brand-gradient text-white' : 'bg-card',
              )}
            >
              {!m.mine && (
                <p className="mb-0.5 text-xs font-semibold text-primary">
                  {m.sender.fullName}
                  {m.sender.role && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · {tr(m.sender.role as 'MANAGER')}
                    </span>
                  )}
                </p>
              )}
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              {m.attachment &&
                (m.attachment.mime.startsWith('audio/') ? (
                  <audio
                    controls
                    preload="none"
                    src={fileUrl(`/messages/threads/${id}/files/${m.id}`)}
                    className="mt-1 h-10 max-w-64"
                  />
                ) : m.attachment.mime.startsWith('image/') ? (
                  <a
                    href={fileUrl(`/messages/threads/${id}/files/${m.id}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={fileUrl(`/messages/threads/${id}/files/${m.id}`)}
                      alt={m.attachment.name}
                      className="mt-1 max-h-60 rounded-xl"
                    />
                  </a>
                ) : (
                  <a
                    href={fileUrl(`/messages/threads/${id}/files/${m.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm underline',
                      m.mine ? 'bg-white/15' : 'bg-muted',
                    )}
                  >
                    <FileText className="size-4" /> {m.attachment.name}
                  </a>
                ))}
              <p
                className={cn(
                  'mt-1 flex items-center gap-1 text-[11px]',
                  m.mine ? 'text-white/75' : 'text-muted-foreground',
                )}
              >
                {time(m.createdAt)}
                {m.mine &&
                  (m.read ? (
                    <CheckCheck className="size-3.5" aria-label={t('read')} />
                  ) : (
                    <Check className="size-3.5" aria-label={t('sent')} />
                  ))}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {thread.canPost && isStaff && (
        <div className="flex gap-2 overflow-x-auto border-t px-3 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setBody(t(`quick.${i}` as 'quick.0'))}
              className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
            >
              {t(`quick.${i}` as 'quick.0')}
            </button>
          ))}
        </div>
      )}
      {thread.canPost ? (
        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate(undefined);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) send.mutate(f);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            aria-label={t('attach')}
          >
            <Paperclip />
          </Button>
          <Button
            type="button"
            variant={recording ? 'destructive' : 'ghost'}
            size="icon"
            onClick={() => void toggleRecord()}
            aria-label={recording ? t('stopRecording') : t('record')}
          >
            {recording ? <Square /> : <Mic />}
          </Button>
          {recording > 0 && (
            <span className="self-center text-sm font-medium text-destructive tabular-nums">
              {t('recording', { s: recording - 1 })}
            </span>
          )}
          <Textarea
            rows={1}
            className="max-h-32 min-h-11 flex-1 resize-none"
            placeholder={t('placeholder')}
            value={body}
            maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (body.trim()) send.mutate(undefined);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!body.trim() || send.isPending}
            aria-label={t('send')}
          >
            <SendHorizontal className="rtl:-scale-x-100" />
          </Button>
        </form>
      ) : (
        <p className="flex items-center justify-center gap-2 border-t p-3 text-sm text-muted-foreground">
          <Badge variant="muted">{t('kinds.ANNOUNCEMENT')}</Badge> {t('readOnly')}
        </p>
      )}
    </div>
  );
}
