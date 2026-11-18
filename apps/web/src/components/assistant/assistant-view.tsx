'use client';

import type { AssistantOp, AssistantPlan, AssistantResult, IssuedPassword } from '@latif/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Info,
  Paperclip,
  SendHorizontal,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';

type Turn =
  | { id: number; role: 'user'; text: string; fileName?: string }
  | {
      id: number;
      role: 'assistant';
      plan: AssistantPlan;
      selected: boolean[];
      results?: AssistantResult[];
    };

/** CSV templates (Arabic headers; English headers work too). */
const TEMPLATES = {
  children:
    'اسم الطفل,الجنس,تاريخ الميلاد,الفصل,ولي الأمر,جوال ولي الأمر,بريد ولي الأمر,صلة القرابة,ملاحظات طبية,الفرع\n',
  people: 'الاسم,البريد الإلكتروني,الجوال,الدور,الفصول,الفرع\n',
  classes: 'النوع,الاسم,السعة,الفرع\n',
  plans: 'النوع,الاسم,السعر,المدة,الفرع\n',
} as const;

function download(name: string, text: string) {
  // BOM so Excel opens Arabic correctly.
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Left-to-right isolate for numbers / emails inside RTL text. */
const ltr = (v: string | undefined | null) => (v ? `\u2066${v}\u2069` : '');

/** One readable line per proposed operation. */
function useDescribe() {
  const t = useTranslations('assistant.ops');
  const tf = useTranslations('settings.features');
  const tr = useTranslations('users.roles');
  return (op: AssistantOp): string => {
    switch (op.type) {
      case 'class.create':
        return t('classCreate', { name: op.name, capacity: op.capacity });
      case 'user.create':
        return t('userCreate', {
          role: tr(op.role),
          name: op.fullName,
          contact: ltr(op.email ?? op.phone),
          classes: op.classNames.join('، ') || '—',
        });
      case 'user.update':
        return t('userUpdate', {
          match: op.match,
          changes: [op.fullName, op.phone, op.role && tr(op.role), op.classNames?.join('، ')]
            .filter(Boolean)
            .join(' · '),
        });
      case 'user.deactivate':
        return t('userDeactivate', { match: op.match });
      case 'child.create':
        return t('childCreate', {
          name: op.fullName,
          birthDate: op.birthDate,
          className: op.className ?? '—',
          guardian: `${op.guardianName} (${op.guardianRelationship}) ${ltr(op.guardianPhone ?? op.guardianEmail)}`,
        });
      case 'child.move':
        return t('childMove', { name: op.childName, className: op.className });
      case 'branch.update':
        return t('branchUpdate', {
          changes: [op.name, op.nameEn, op.phone, op.email, op.city, op.address]
            .filter(Boolean)
            .join(' · '),
        });
      case 'feature.set':
        return t(op.enabled ? 'featureOn' : 'featureOff', { feature: tf(op.key) });
      case 'plan.create':
        return t('planCreate', {
          name: op.name,
          price: op.price,
          period: t(`period.${op.period}`),
        });
    }
  };
}

/** "row 3: missing_birth_date" / "class_added: Birds" → localized text. */
function useWarning() {
  const t = useTranslations('assistant.warn');
  return (w: string) => {
    const row = w.match(/^row (\d+): (\w+)$/);
    if (row && t.has(row[2] as never))
      return t('row', { row: row[1]!, problem: t(row[2] as never) });
    const [code, ...rest] = w.split(':');
    const value = rest.join(':').trim();
    return t.has(code as never) ? t(code as never, { value } as never) : w;
  };
}

function IssuedList({ items }: { items: IssuedPassword[] }) {
  const t = useTranslations('assistant');
  if (items.length === 0) return null;
  const text = items.map((i) => `${i.fullName}\t${i.identifier}\t${i.tempPassword}`).join('\n');
  return (
    <div className="grid gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
      <p className="font-medium">{t('passwordsTitle')}</p>
      <p className="text-muted-foreground">{t('passwordsHint')}</p>
      <ul className="grid gap-1">
        {items.map((i) => (
          <li key={i.identifier} className="flex flex-wrap gap-x-3">
            <span>{i.fullName}</span>
            <span dir="ltr" className="text-muted-foreground">
              {i.identifier}
            </span>
            <code dir="ltr" className="font-semibold">
              {i.tempPassword}
            </code>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void navigator.clipboard.writeText(text).then(() => toast.success(t('copied')))
          }
        >
          <Copy /> {t('copyAll')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            download(
              'latif-kids-passwords.csv',
              `name,login,password\n${text.replaceAll('\t', ',')}`,
            )
          }
        >
          <Download /> {t('downloadCsv')}
        </Button>
      </div>
    </div>
  );
}

function PlanCard({
  turn,
  onToggle,
  onApplied,
}: {
  turn: Extract<Turn, { role: 'assistant' }>;
  onToggle: (i: number) => void;
  onApplied: (r: AssistantResult[]) => void;
}) {
  const t = useTranslations('assistant');
  const errorMessage = useErrorMessage();
  const describe = useDescribe();
  const warning = useWarning();
  const { plan, selected, results } = turn;
  const chosen = plan.operations.filter((_, i) => selected[i]);
  const apply = useMutation({
    mutationFn: () => api.post<AssistantResult[]>('/assistant/apply', { operations: chosen }),
    onSuccess: (r) => {
      // Map results (indexes of the chosen subset) back to the full list.
      const map = plan.operations.map((_, i) => i).filter((i) => selected[i]);
      onApplied(r.map((x) => ({ ...x, index: map[x.index]! })));
      const done = r.filter((x) => x.status === 'done').length;
      toast.success(t('appliedToast', { done, total: r.length }));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resultOf = (i: number) => results?.find((r) => r.index === i);
  const issued = (results ?? [])
    .map((r) => r.issued)
    .filter((x): x is IssuedPassword => Boolean(x));
  const detail = (d: string | null) => {
    if (!d) return '';
    const code = d.split(':')[0]!;
    const te = (k: string) =>
      t.has(`detail.${k}` as never)
        ? t(`detail.${k}` as never, { value: d.split(':').slice(1).join(':').trim() } as never)
        : null;
    return te(code) ?? errorMessage(code);
  };

  return (
    <div className="grid gap-3">
      {plan.reply && <p className="whitespace-pre-wrap text-sm">{plan.reply}</p>}
      {plan.operations.length === 0 && !plan.reply && plan.warnings.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('nothingFound')}</p>
      )}
      {plan.warnings.length > 0 && (
        <ul className="grid gap-1 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          {plan.warnings.map((w, i) => (
            <li key={i} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0" /> {warning(w)}
            </li>
          ))}
        </ul>
      )}
      {plan.operations.length > 0 && (
        <>
          <p className="text-sm font-medium">
            {t('reviewTitle', { count: plan.operations.length })}
          </p>
          <ul className="grid gap-1.5">
            {plan.operations.map((op, i) => {
              const r = resultOf(i);
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border bg-card p-2.5 text-sm"
                >
                  {results ? (
                    r?.status === 'done' ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : r ? (
                      <XCircle
                        className={`mt-0.5 size-4 shrink-0 ${r.status === 'skipped' ? 'text-muted-foreground' : 'text-destructive'}`}
                      />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )
                  ) : (
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                      checked={selected[i]}
                      onChange={() => onToggle(i)}
                      aria-label={describe(op)}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    {describe(op)}
                    {op.branch && <span className="text-muted-foreground"> · {op.branch}</span>}
                  </span>
                  {r && r.status !== 'done' && (
                    <StatusChip color={r.status === 'skipped' ? 'gray' : 'red'}>
                      {t(`status.${r.status}`)}
                      {r.detail ? ` · ${detail(r.detail)}` : ''}
                    </StatusChip>
                  )}
                </li>
              );
            })}
          </ul>
          {!results && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={chosen.length === 0 || apply.isPending}
                onClick={() => apply.mutate()}
              >
                <CheckCircle2 /> {t('apply', { count: chosen.length })}
              </Button>
              <span className="text-xs text-muted-foreground">{t('applyHint')}</span>
            </div>
          )}
          <IssuedList items={issued} />
        </>
      )}
    </div>
  );
}

/** Smart assistant: type or paste data, or attach a CSV; review; confirm. */
export function AssistantView() {
  const t = useTranslations('assistant');
  const tn = useTranslations('nav');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const status = useQuery({
    queryKey: ['assistant', 'status'],
    queryFn: () => api.get<{ aiEnabled: boolean }>('/assistant/status'),
  });
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length]);

  const send = useMutation({
    mutationFn: (v: { message: string; file: { name: string; text: string } | null }) => {
      const history = turns
        .slice(-8)
        .map((x) =>
          x.role === 'user'
            ? { role: 'user' as const, text: x.text.slice(0, 4000) }
            : { role: 'assistant' as const, text: (x.plan.reply || '…').slice(0, 4000) },
        );
      return api.post<AssistantPlan>('/assistant/plan', {
        message: v.message,
        file: v.file ?? undefined,
        history,
        locale,
      });
    },
    onSuccess: (plan) =>
      setTurns((ts) => [
        ...ts,
        { id: Date.now(), role: 'assistant', plan, selected: plan.operations.map(() => true) },
      ]),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = () => {
    const message = text.trim();
    if (!message && !file) return;
    setTurns((ts) => [
      ...ts,
      { id: Date.now(), role: 'user', text: message, fileName: file?.name },
    ]);
    send.mutate({ message, file });
    setText('');
    setFile(null);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (/\.(xlsx?|numbers)$/i.test(f.name)) return toast.error(t('saveAsCsv'));
    if (f.size > 2_000_000) return toast.error(t('fileTooBig'));
    setFile({ name: f.name, text: await f.text() });
  };

  const update = (id: number, fn: (x: Extract<Turn, { role: 'assistant' }>) => Turn) =>
    setTurns((ts) => ts.map((x) => (x.id === id && x.role === 'assistant' ? fn(x) : x)));

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex min-h-[60vh] min-w-0 flex-col p-0">
          <div className="grid flex-1 content-start gap-4 p-5">
            {turns.length === 0 && (
              <div className="grid gap-3 py-6 text-center">
                <Sparkles className="mx-auto size-10 text-primary" />
                <p className="font-semibold">{t('emptyTitle')}</p>
                <p className="mx-auto max-w-lg text-sm text-muted-foreground">{t('emptyBody')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {(['example1', 'example2', 'example3'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setText(t(k))}
                      className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      {t(k)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((x) =>
              x.role === 'user' ? (
                <div
                  key={x.id}
                  className="ms-auto grid max-w-[85%] gap-1 rounded-2xl rounded-ee-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                >
                  {x.fileName && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <FileSpreadsheet className="size-4" /> {x.fileName}
                    </span>
                  )}
                  {x.text && <span className="whitespace-pre-wrap break-words">{x.text}</span>}
                </div>
              ) : (
                <div
                  key={x.id}
                  className="me-auto w-full max-w-[95%] rounded-2xl rounded-es-sm border bg-muted/40 p-4"
                >
                  <PlanCard
                    turn={x}
                    onToggle={(i) =>
                      update(x.id, (y) => ({
                        ...y,
                        selected: y.selected.map((s, j) => (j === i ? !s : s)),
                      }))
                    }
                    onApplied={(results) => update(x.id, (y) => ({ ...y, results }))}
                  />
                </div>
              ),
            )}
            {send.isPending && <p className="text-sm text-muted-foreground">{t('thinking')}</p>}
            <div ref={bottom} />
          </div>
          <form
            className="grid gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {file && (
              <span className="flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                <FileSpreadsheet className="size-4" /> {file.name}
                <button type="button" aria-label={t('removeFile')} onClick={() => setFile(null)}>
                  <X className="size-4" />
                </button>
              </span>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('attach')}
                title={t('attach')}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip />
              </Button>
              <Textarea
                aria-label={t('placeholder')}
                placeholder={status.data?.aiEnabled ? t('placeholder') : t('placeholderTable')}
                className="max-h-48 min-h-11 flex-1 resize-y"
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                aria-label={t('send')}
                disabled={send.isPending || (!text.trim() && !file)}
              >
                <SendHorizontal className="rtl:-scale-x-100" />
              </Button>
            </div>
          </form>
        </Card>
        <div className="grid content-start gap-4">
          <Card className="grid gap-2 p-5 text-sm">
            <h2 className="font-semibold">{t('howTitle')}</h2>
            <ol className="ms-4 grid list-decimal gap-1 text-muted-foreground">
              <li>{t('how1')}</li>
              <li>{t('how2')}</li>
              <li>{t('how3')}</li>
            </ol>
            {status.data && !status.data.aiEnabled && (
              <p className="rounded-xl bg-muted p-3 text-muted-foreground">{t('aiOff')}</p>
            )}
          </Card>
          <Card className="grid gap-2 p-5 text-sm">
            <h2 className="font-semibold">{t('templatesTitle')}</h2>
            <p className="text-muted-foreground">{t('templatesHint')}</p>
            {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((k) => (
              <Button
                key={k}
                variant="outline"
                className="justify-start"
                onClick={() => download(`latif-kids-${k}.csv`, TEMPLATES[k])}
              >
                <Download /> {t(`template.${k}`)}
              </Button>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
