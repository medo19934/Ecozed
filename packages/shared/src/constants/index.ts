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

/** Week runs Saturday → Thursday; Friday is closed. JS getDay(): 0=Sun … 5=Fri, 6=Sat. */
export const WEEK_START_DAY = 6;
export const CLOSED_WEEKDAYS: readonly number[] = [5];
export const WORK_WEEK: readonly number[] = [6, 0, 1, 2, 3, 4];

/** The organisation's branches (seeded; edited by super admin). */
export const BRANCHES = [
  { slug: 'al-malqa', nameAr: 'فرع الملقا', nameEn: 'Al Malqa' },
  { slug: 'al-rayan', nameAr: 'فرع الريان', nameEn: 'Al Rayan' },
  { slug: 'olaya', nameAr: 'فرع العليا', nameEn: 'Olaya' },
] as const;

export const PAGINATION = { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 } as const;

export const ATTENDANCE = {
  /** Kiosk QR rotates this often; a code is accepted for one extra window to absorb scan delay. */
  QR_WINDOW_SECONDS: 30,
  /** Ignore a second scan / PIN for the same person within this time. */
  DEBOUNCE_SECONDS: 60,
} as const;

/** YYYY-MM-DD for `at` in a time zone (default Asia/Riyadh). */
export const localDate = (at: Date = new Date(), timeZone = DEFAULT_TIMEZONE): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
