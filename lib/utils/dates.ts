import { startOfWeek, format, addDays, isSameWeek } from "date-fns";

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function weekdayLabel(weekday: number | null | undefined) {
  if (weekday == null) return null;
  return WEEKDAY_LABELS[weekday - 1] ?? null;
}

/** ISO Monday for the supplied date (defaults to now). */
export function weekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekStartISO(date: Date = new Date()): string {
  return format(weekStart(date), "yyyy-MM-dd");
}

export function formatWeekRange(date: Date = new Date()): string {
  const start = weekStart(date);
  const end = addDays(start, 4);
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function isThisWeek(date: Date) {
  return isSameWeek(date, new Date(), { weekStartsOn: 1 });
}

/** 1 = Mon, 2 = Tue, ..., 5 = Fri. Returns null for Sat/Sun. */
export function todayWeekday(date: Date = new Date()): number | null {
  const dow = date.getDay(); // 0=Sun..6=Sat
  if (dow === 0 || dow === 6) return null;
  return dow; // 1..5 line up because we treat Mon=1
}

export function formatPostDate(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}
