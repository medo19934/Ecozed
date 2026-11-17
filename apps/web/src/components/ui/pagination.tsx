'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from './button';

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const t = useTranslations('common');
  return (
    <nav
      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
      aria-label={t('pagination')}
    >
      <span className="text-muted-foreground">{t('pageOf', { page, totalPages, total })}</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('prev')}
        >
          <ChevronRight className="ltr:rotate-180" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label={t('next')}
        >
          <ChevronLeft className="ltr:rotate-180" />
        </Button>
      </div>
    </nav>
  );
}
