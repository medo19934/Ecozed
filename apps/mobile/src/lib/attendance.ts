import type { DayStatus, MyAttendance } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const MY_DAY_KEY = ['attendance', 'me'] as const;

export const useMyDay = () =>
  useQuery({
    queryKey: MY_DAY_KEY,
    queryFn: () => api.get<MyAttendance>('/attendance/me'),
    refetchInterval: 60_000,
  });

export const STATUS_STYLE: Record<DayStatus, { bg: string; fg: string }> = {
  ATTENDED: { bg: '#e3f5ea', fg: '#1f8a52' },
  ABSENT: { bg: '#fde7e8', fg: '#c5343a' },
  VACATION: { bg: '#fdf0dc', fg: '#a8661a' },
  DEPARTURE: { bg: '#e9ecf6', fg: '#3f4d8a' },
  NO_RECORD: { bg: '#eef0f3', fg: '#6b7280' },
};

export const timeOf = (iso: string | null, locale: string) =>
  iso
    ? new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
