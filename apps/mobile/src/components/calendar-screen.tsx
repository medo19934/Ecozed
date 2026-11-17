import { CLOSED_WEEKDAYS, localDate, type CalendarEventDto } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight, Clock, School, User, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  I18nManager,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { ScreenHeader } from './screen-header';
import { Card, Screen } from './ui';

export const TYPE_COLOR: Record<CalendarEventDto['type'], string> = {
  LESSON: '#5b6db4',
  ACTIVITY: '#2fb36d',
  EVENT: '#7b649b',
  HOLIDAY: '#e5484d',
  MEETING: '#f2a33a',
  TRIP: '#0ea5e9',
};

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const add = (iso: string, n: number) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const saturdayOf = (iso: string) => add(iso, -((parse(iso).getUTCDay() + 1) % 7));

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      {icon}
      <Text className="w-20 text-start text-sm text-ink-muted">{label}</Text>
      <Text className="flex-1 text-start text-sm font-medium text-ink">{value}</Text>
    </View>
  );
}

/** Day strip (Saturday → Friday, Friday closed) + day list + bottom-sheet details. */
export function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const today = localDate();
  const [week, setWeek] = useState(() => saturdayOf(today));
  const [day, setDay] = useState(today);
  const [open, setOpen] = useState<CalendarEventDto | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => add(week, i)), [week]);
  const q = useQuery({
    queryKey: ['calendar', week],
    queryFn: () => api.get<CalendarEventDto[]>(`/calendar?from=${days[0]}&to=${days[6]}`),
  });
  const on = (iso: string) => (q.data ?? []).filter((e) => e.startDate <= iso && e.endDate >= iso);
  const list = on(day);
  const closed = CLOSED_WEEKDAYS.includes(parse(day).getUTCDay());
  // Arrows follow reading direction (Arabic: previous points right).
  const rtl = I18nManager.isRTL || i18n.language === 'ar';
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const shiftWeek = (n: number) => {
    const w = add(week, 7 * n);
    setWeek(w);
    setDay(w);
  };

  return (
    <Screen>
      <ScreenHeader title={t('cal.title')} subtitle={day} />
      <View className="gap-3 px-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cal.prevWeek')}
            onPress={() => shiftWeek(-1)}
            className="h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <PrevIcon color="#5b6db4" size={20} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setWeek(saturdayOf(today));
              setDay(today);
            }}
            className="min-h-11 justify-center rounded-full bg-white px-4"
          >
            <Text className="font-semibold text-brand">{t('cal.today')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cal.nextWeek')}
            onPress={() => shiftWeek(1)}
            className="h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <NextIcon color="#5b6db4" size={20} />
          </Pressable>
        </View>
        <View className="flex-row gap-1.5">
          {days.map((d) => {
            const sel = d === day;
            const isClosed = CLOSED_WEEKDAYS.includes(parse(d).getUTCDay());
            const count = on(d).length;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                onPress={() => setDay(d)}
                className={`flex-1 items-center rounded-2xl py-2.5 ${sel ? 'bg-brand' : isClosed ? 'bg-line' : 'bg-white'}`}
              >
                <Text
                  numberOfLines={1}
                  className={`text-[10px] ${sel ? 'text-white' : 'text-ink-muted'}`}
                >
                  {t(`weekdays.${parse(d).getUTCDay()}`)}
                </Text>
                <Text
                  className={`text-base font-semibold ${sel ? 'text-white' : isClosed ? 'text-ink-muted' : 'text-ink'}`}
                >
                  {parse(d).getUTCDate()}
                </Text>
                <View
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${count ? (sel ? 'bg-white' : 'bg-brand') : 'bg-transparent'}`}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        }
      >
        {closed && (
          <Text className="text-start text-xs font-semibold text-ink-muted">{t('cal.closed')}</Text>
        )}
        {q.isLoading ? (
          <ActivityIndicator color="#5b6db4" />
        ) : list.length === 0 ? (
          <Card>
            <Text className="text-center text-sm text-ink-muted">{t('cal.none')}</Text>
          </Card>
        ) : (
          list.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              onPress={() => setOpen(e)}
              className="flex-row items-center gap-3 rounded-3xl border border-line bg-white p-4"
              style={{ borderStartWidth: 5, borderStartColor: TYPE_COLOR[e.type] }}
            >
              <View className="w-16">
                <Text
                  style={{ writingDirection: 'ltr' }}
                  className="text-start text-sm font-semibold text-ink"
                >
                  {e.startTime ?? t('cal.allDay')}
                </Text>
                {e.endTime && (
                  <Text className="text-start text-xs text-ink-muted">{e.endTime}</Text>
                )}
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-start text-base font-semibold text-ink">{e.title}</Text>
                <Text className="text-start text-xs text-ink-muted">
                  {[
                    t(`cal.types.${e.type}`),
                    e.classroom?.name ?? t(`cal.audiences.${e.audience}`),
                  ].join(' · ')}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable
          accessibilityLabel={t('cal.close')}
          onPress={() => setOpen(null)}
          className="flex-1 bg-black/40"
        />
        {open && (
          <View
            className="gap-2 rounded-t-3xl bg-white px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <View className="mb-2 h-1.5 w-12 self-center rounded-full bg-line" />
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <View className="flex-row">
                  <Text
                    style={{
                      backgroundColor: `${TYPE_COLOR[open.type]}22`,
                      color: TYPE_COLOR[open.type],
                    }}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  >
                    {t(`cal.types.${open.type}`)}
                  </Text>
                </View>
                <Text className="text-start text-xl font-bold text-ink">{open.title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cal.close')}
                onPress={() => setOpen(null)}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface"
              >
                <X color="#1e1b3a" size={18} />
              </Pressable>
            </View>
            {open.description && (
              <Text className="text-start text-sm leading-6 text-ink">{open.description}</Text>
            )}
            <View className="mt-2 border-t border-line pt-2">
              <Row
                icon={<Clock color="#6b6b86" size={16} />}
                label={t('cal.date')}
                value={
                  open.startDate === open.endDate
                    ? open.startDate
                    : `${open.startDate} → ${open.endDate}`
                }
              />
              {(open.startTime || open.endTime) && (
                <Row
                  icon={<Clock color="#6b6b86" size={16} />}
                  label={`${t('cal.from')} / ${t('cal.to')}`}
                  value={`${open.startTime ?? ''} – ${open.endTime ?? ''}`}
                />
              )}
              {open.unit && (
                <Row
                  icon={<BookOpen color="#6b6b86" size={16} />}
                  label={t('cal.unit')}
                  value={open.unit.name}
                />
              )}
              {open.classroom && (
                <Row
                  icon={<School color="#6b6b86" size={16} />}
                  label={t('cal.class')}
                  value={open.classroom.name}
                />
              )}
              {open.teacher && (
                <Row
                  icon={<User color="#6b6b86" size={16} />}
                  label={t('cal.teacher')}
                  value={open.teacher.fullName}
                />
              )}
            </View>
          </View>
        )}
      </Modal>
    </Screen>
  );
}
