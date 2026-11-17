import { CLOSED_WEEKDAYS } from '@latif/shared';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

/** Saturday → Friday strip for the current week; Friday is closed. */
export function WeekStrip() {
  const { t } = useTranslation();
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 1) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return (
    <View className="flex-row gap-1.5" accessibilityLabel={t('home.thisWeek')}>
      {days.map((d) => {
        const closed = CLOSED_WEEKDAYS.includes(d.getDay());
        const isToday = d.toDateString() === today.toDateString();
        return (
          <View
            key={d.toISOString()}
            className={`flex-1 items-center rounded-2xl py-2.5 ${isToday ? 'bg-brand' : closed ? 'bg-line' : 'bg-white'}`}
          >
            <Text
              numberOfLines={1}
              className={`text-[10px] ${isToday ? 'text-white' : 'text-ink-muted'}`}
            >
              {t(`weekdays.${d.getDay()}`)}
            </Text>
            <Text
              className={`text-base font-semibold ${isToday ? 'text-white' : closed ? 'text-ink-muted' : 'text-ink'}`}
            >
              {d.getDate()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
