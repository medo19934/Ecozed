import { useTranslation } from 'react-i18next';
import { ApiError } from './api';

/** Localized message for an API error code (never shows raw keys). */
export function useApiError() {
  const { t, i18n } = useTranslation();
  return (e: unknown): string => {
    const code = e instanceof ApiError ? e.code : undefined;
    if (code && i18n.exists(`errors.${code}`)) return t(`errors.${code}`);
    if (e instanceof ApiError && e.status === 403) return t('errors.forbidden');
    return t('common.error');
  };
}
