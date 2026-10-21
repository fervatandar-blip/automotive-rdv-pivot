import { todayKeyInAppZone } from "@/lib/timezone";

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// The garage's local date, not the server's (UTC on Vercel). The rest of
// this module is calendar-grid arithmetic on local-midnight Dates, which is
// zone-independent as long as it's only ever round-tripped through
// toDateKey/parseDateKey.
export function todayKey() {
  return todayKeyInAppZone();
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Always 42 days (6 full weeks) so month-grid layout stays a fixed size. */
export function monthGridDays(date: Date) {
  const gridStart = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
