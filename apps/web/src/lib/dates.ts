/** Pure ISO-date (YYYY-MM-DD) helpers in UTC, so calendar math never shifts with the viewer's time zone. */
export const parseIso = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
export const dow = (iso: string) => parseIso(iso).getUTCDay();
/** Saturday on or before the date (week runs Saturday → Friday). */
export const weekStart = (iso: string) => addDays(iso, -((dow(iso) + 1) % 7));
export const monthStart = (iso: string) => `${iso.slice(0, 8)}01`;
export const addMonths = (iso: string, n: number) => {
  const d = parseIso(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toIso(d);
};
export const range = (from: string, days: number) =>
  Array.from({ length: days }, (_, i) => addDays(from, i));
