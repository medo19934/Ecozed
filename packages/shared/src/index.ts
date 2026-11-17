export const APP_NAME = 'Latif Kids';
export const DEFAULT_LOCALE = 'ar' as const;
export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_CURRENCY = 'SAR';
