import type { DayStatus } from '@latif/shared';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { STATUS_STYLE } from '@/lib/attendance';

export function StatusPill({ status, label }: { status: DayStatus; label?: string }) {
  const { t } = useTranslation();
  const s = STATUS_STYLE[status];
  return (
    <View style={{ backgroundColor: s.bg }} className="rounded-full px-2.5 py-1">
      <Text style={{ color: s.fg }} className="text-xs font-semibold">
        {label ?? t(`status.${status}`)}
      </Text>
    </View>
  );
}
