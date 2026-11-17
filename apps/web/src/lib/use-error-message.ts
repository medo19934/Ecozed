'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from './api-client';

/** Maps API error codes / zod messages to localized text. */
export function useErrorMessage() {
  const t = useTranslations('auth.errors');
  const tc = useTranslations('common');
  return (error: unknown): string => {
    const code =
      error instanceof ApiError ? error.code : typeof error === 'string' ? error : undefined;
    if (code && t.has(code as never)) return t(code as never);
    return tc('errorGeneric');
  };
}
