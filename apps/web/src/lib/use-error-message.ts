'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from './api-client';

/** Maps API error codes to localized text (never shows raw keys). */
export function useErrorMessage() {
  const ta = useTranslations('auth.errors');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  return (error: unknown): string => {
    const code =
      error instanceof ApiError ? error.code : typeof error === 'string' ? error : undefined;
    if (code && ta.has(code as never)) return ta(code as never);
    if (code && te.has(code as never)) return te(code as never);
    if (error instanceof ApiError && error.status === 403) return te('forbidden');
    if (error instanceof ApiError && error.status === 404) return te('not_found');
    return tc('errorGeneric');
  };
}
