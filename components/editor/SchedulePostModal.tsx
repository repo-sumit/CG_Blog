"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

interface Props {
  open: boolean;
  /** ISO datetime — used to pre-fill the picker when editing an existing schedule. */
  initialValue: string | null;
  busy?: boolean;
  onCancel: () => void;
  /** Resolves with an ISO 8601 (UTC) timestamp the server can store. */
  onConfirm: (iso: string) => void;
}

/**
 * Native datetime-local input rendered inside a dark-portal modal. We keep
 * the input native (rather than a custom picker) so mobile gets the OS-native
 * date+time UI, which is far less buggy than any homegrown widget.
 *
 * The value the input edits is a "local datetime" string (`YYYY-MM-DDTHH:mm`).
 * We convert to/from ISO at the modal boundary — the server only ever sees
 * a full ISO 8601 timestamp.
 */
export function SchedulePostModal({ open, initialValue, busy, onCancel, onConfirm }: Props) {
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Seed the picker from initialValue, falling back to "tomorrow 09:00 local".
  useEffect(() => {
    if (!open) return;
    setError(null);
    setValue(initialValue ? toLocalInputValue(new Date(initialValue)) : defaultSlot());
    // Focus the input on the next paint so keyboard users can start typing
    // immediately.
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open, initialValue]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  const minAttr = useMemo(() => toLocalInputValue(new Date(Date.now() + 60_000)), [open]); // +1 min

  if (!open) return null;

  function handleConfirm() {
    if (!value) {
      setError("Pick a date and time.");
      return;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      setError("That date and time isn't valid.");
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      setError("Choose a future date and time.");
      return;
    }
    onConfirm(parsed.toISOString());
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-post-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close schedule dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !busy && onCancel()}
      />

      <div className="relative w-full max-w-md rounded-md border-2 border-portal-border-muted bg-portal-panel-raised shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <header className="flex items-start justify-between gap-4 border-b-2 border-portal-border-soft px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-portal-orange">
              <Calendar className="h-3.5 w-3.5" /> Schedule
            </div>
            <h2 id="schedule-post-title" className="mt-1 font-hero text-xl font-bold uppercase tracking-tighter text-portal-text">
              Schedule post
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-portal-text-muted transition-colors hover:bg-portal-panel-soft hover:text-portal-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-relaxed text-portal-text-muted">
            Pick when this transmission should go live. The post stays private to you and
            collaborators until that moment, then publishes automatically.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-portal-text-muted">
              Publish at (your local time)
            </span>
            <input
              ref={inputRef}
              type="datetime-local"
              value={value}
              min={minAttr}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              className={cn(
                "h-12 w-full rounded-md border-2 bg-portal-panel-soft px-4 font-ui text-sm text-portal-text",
                "focus:outline-none focus:border-portal-blue focus:shadow-[0_0_0_4px_rgba(79,140,255,0.18)]",
                error ? "border-portal-red" : "border-portal-border-muted",
              )}
            />
            {error && <span className="mt-1 block text-[11px] font-medium text-portal-red">{error}</span>}
          </label>

          <p className="text-[10px] uppercase tracking-wider text-portal-text-muted">
            Times are stored in UTC and shown in your browser's timezone.
          </p>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t-2 border-portal-border-soft px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Confirm schedule
          </Button>
        </footer>
      </div>
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Convert a Date into the `YYYY-MM-DDTHH:mm` string `datetime-local` wants. */
function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default slot: tomorrow at 09:00 local. */
function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInputValue(d);
}
