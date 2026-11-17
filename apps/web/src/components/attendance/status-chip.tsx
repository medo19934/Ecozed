import type { DayStatus } from '@latif/shared';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/status-chip';

const COLOR: Record<DayStatus, 'green' | 'red' | 'amber' | 'gray' | 'blue'> = {
  ATTENDED: 'green',
  ABSENT: 'red',
  VACATION: 'amber',
  DEPARTURE: 'blue',
  NO_RECORD: 'gray',
};

export function DayStatusChip({ status }: { status: DayStatus }) {
  const t = useTranslations('status');
  return <StatusChip color={COLOR[status]}>{t(status)}</StatusChip>;
}
