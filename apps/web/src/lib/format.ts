'use client';

import { ageParts } from '@latif/shared';
import { useFormatter, useTranslations } from 'next-intl';

/** "3 years 5 months" / "3 سنوات و5 أشهر" */
export function useFormatAge() {
  const t = useTranslations('age');
  return (birthDate: string): string => {
    const { years, months } = ageParts(new Date(`${birthDate}T00:00:00`));
    const y = years ? t('years', { count: years }) : '';
    const m = months ? t('months', { count: months }) : '';
    if (y && m) return t('join', { a: y, b: m });
    return y || m || t('newborn');
  };
}

export function useFormatDate() {
  const f = useFormatter();
  return (iso: string | null | undefined) =>
    iso
      ? f.dateTime(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso), { dateStyle: 'medium' })
      : '—';
}

export const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

/** Gregorian + Hijri (Umm al-Qura) date and time for a timestamp. */
export function useDualDate() {
  const f = useFormatter();
  return (iso: string) => {
    const d = new Date(iso);
    let hijri = '';
    try {
      hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      /* calendar unsupported */
    }
    return {
      gregorian: f.dateTime(d, { dateStyle: 'medium' }),
      hijri,
      time: f.dateTime(d, { timeStyle: 'short' }),
    };
  };
}
