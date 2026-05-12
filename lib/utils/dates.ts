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

/**
 * Compute the UTC instant when a post should go live, given the week-start
 * Monday (yyyy-MM-dd) and an assigned weekday (1=Mon..5=Fri). Posts go live
 * at 09:00 UTC on the assigned day — gives the digest a stable slot and is
 * after typical India + EU work-day starts.
 */
export function publishSlotFor(weekStartISO: string, weekday: number): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartISO);
  if (!m) throw new Error(`Invalid week start: ${weekStartISO}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const offset = Math.min(Math.max(weekday, 1), 5) - 1; // clamp to Mon..Fri
  return new Date(Date.UTC(y, mo, d + offset, 9, 0, 0));
}

/**
 * Short human label for a scheduled-for date — used in the editor toast/badge.
 * Rendered in the viewer's local timezone (date-fns `format`) so authors see a
 * time that matches their clock, not the underlying 09:00 UTC slot.
 */
export function formatScheduledLabel(iso: string): string {
  try {
    return format(new Date(iso), "EEE, MMM d 'at' HH:mm");
  } catch {
    return iso;
  }
}

export function formatPostDate(iso: string): string {
  try {
    // `YYYY-MM-DD` (Postgres DATE) is parsed as UTC midnight by `new Date()`,
    // which renders as the previous day in timezones west of UTC. Parse such
    // values as a local date instead.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split("-").map(Number);
      return format(new Date(y as number, (m as number) - 1, d as number), "MMM d, yyyy");
    }
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}
