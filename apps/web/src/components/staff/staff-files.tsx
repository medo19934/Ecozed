'use client';

import type { DocumentDto } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Download, FileText, FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api, fileUrl } from '@/lib/api-client';
import { formatBytes, useFormatDate } from '@/lib/format';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';

/** Private staff files: upload, download, delete to bin, restore. */
export function StaffFiles({ membershipId }: { membershipId: string }) {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const fmt = useFormatDate();
  const errorMessage = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [bin, setBin] = useState(false);
  const [search, setSearch] = useState('');
  const base = `/staff/${membershipId}/files`;
  const files = useQuery({
    queryKey: ['staff', membershipId, 'files', bin],
    queryFn: () => api.get<DocumentDto[]>(`${base}?deleted=${bin}`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['staff', membershipId, 'files'] });
  const upload = useMutation({
    mutationFn: (file: File) => api.upload<DocumentDto>(base, file),
    onSuccess: () => {
      void refresh();
      toast.success(tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`${base}/${id}`),
    onSuccess: () => {
      void refresh();
      toast.success(tc('deleted'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const restore = useMutation({
    mutationFn: (id: string) => api.post(`${base}/${id}/restore`),
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const shown = (files.data ?? []).filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t('fileSearch')}
            placeholder={t('fileSearch')}
            className="ps-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          aria-pressed={bin}
          className={cn(
            bin ? 'border-primary text-primary' : 'border-destructive/40 text-destructive',
          )}
          onClick={() => setBin((b) => !b)}
        >
          {bin ? <FolderOpen /> : <Trash2 />} {bin ? t('liveFiles') : t('deletedFiles')}
        </Button>
        <input
          ref={input}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
        {!bin && (
          <Button disabled={upload.isPending} onClick={() => input.current?.click()}>
            <Plus /> {t('addFile')}
          </Button>
        )}
      </div>
      {files.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !shown.length ? (
        <EmptyState
          icon={bin ? Trash2 : FileText}
          title={bin ? t('noDeletedFiles') : t('noFiles')}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <FileText className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(f.createdAt)} · {formatBytes(f.size)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-1">
                {bin ? (
                  <Button size="sm" variant="ghost" onClick={() => restore.mutate(f.id)}>
                    <ArchiveRestore /> {tc('restore')}
                  </Button>
                ) : (
                  <>
                    <Button size="icon-sm" variant="ghost" asChild>
                      <a
                        href={fileUrl(`${base}/${f.id}`)}
                        download
                        aria-label={`${tc('download')} ${f.name}`}
                      >
                        <Download />
                      </a>
                    </Button>
                    <Confirm
                      title={`${tc('delete')}: ${f.name}`}
                      confirmLabel={tc('delete')}
                      destructive
                      onConfirm={() => del.mutateAsync(f.id)}
                    >
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive"
                        aria-label={`${tc('delete')} ${f.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </Confirm>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
