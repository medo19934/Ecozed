export const APP_NAME = 'Latif Kids';
export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';
export const RTL_LOCALES: readonly Locale[] = ['ar'];
export const isRtl = (locale: string): boolean =>
  (RTL_LOCALES as readonly string[]).includes(locale);

export const DEFAULT_CURRENCY = 'SAR';
export const DEFAULT_COUNTRY_CODE = '+966';
export const DEFAULT_TIMEZONE = 'Asia/Riyadh';
export const TRIAL_DAYS = 14;

export const PAGINATION = { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 } as const;
export const OTP = { LENGTH: 6, TTL_SECONDS: 300, MAX_ATTEMPTS: 5 } as const;
export const PASSWORD_MIN_LENGTH = 8;
