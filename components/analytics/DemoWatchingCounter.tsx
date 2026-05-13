"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * "Demo: N watching" — small simulated presence counter for the public nav.
 *
 * EXPLICIT non-goal: this does NOT represent real readers. The number is
 * locally generated, drifts by small deltas, and always renders with the
 * literal "Demo" / "Simulated" prefix so a reader can never mistake it for
 * real telemetry. When real presence ships, swap this for a Supabase
 * realtime-channel client and switch the colour to green.
 */

const MIN_COUNT = 0;
const MAX_COUNT = 12;
const INITIAL_MIN = 2;
const INITIAL_MAX = 7;
const TICK_MIN_MS = 3_000;
const TICK_MAX_MS = 7_000;
const DELTAS = [-2, -1, 0, 0, 1, 2] as const; // slight 0-bias so it doesn't thrash

const COPY_VARIANTS = [
  (n: number) => `Demo: ${n} watching`,
  (n: number) => `Demo: ${n} reading now`,
  (n: number) => `Simulated: ${n} active`,
  (n: number) => `Demo activity: ${n} browsing`,
] as const;

export type WatchingCounterMode = "demo" | "real";

export interface DemoWatchingCounterProps {
  /** Only "demo" is implemented today; "real" renders an "Activity unavailable" pill. */
  mode?: WatchingCounterMode;
  /** Inclusive lower bound. Defaults to {@link MIN_COUNT}. */
  min?: number;
  /** Inclusive upper bound. Defaults to {@link MAX_COUNT}. */
  max?: number;
  /** Compact = numbers-only label for narrow viewports. */
  compact?: boolean;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickRange(lo: number, hi: number): number {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function pickDelta(): number {
  return DELTAS[Math.floor(Math.random() * DELTAS.length)] ?? 0;
}

function getNextCount(current: number, min: number, max: number): number {
  return clamp(current + pickDelta(), min, max);
}

export function DemoWatchingCounter({
  mode = "demo",
  min = MIN_COUNT,
  max = MAX_COUNT,
  compact = false,
  className,
}: DemoWatchingCounterProps) {
  // Hooks must run unconditionally — branch on `mode` AFTER the hook calls so
  // React's rules-of-hooks invariant holds even when callers swap mode at
  // runtime. The timer effect early-returns when mode !== "demo" instead.
  const variantIndex = useMemo(
    () => Math.floor(Math.random() * COPY_VARIANTS.length),
    [],
  );

  // We deliberately render `null` during SSR + the first client paint so the
  // server-rendered HTML stays deterministic and React never warns about a
  // hydration mismatch. Once mounted, the counter takes over.
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState<number>(() =>
    clamp(pickRange(INITIAL_MIN, INITIAL_MAX), min, max),
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    if (mode !== "demo") return;
    function scheduleNext() {
      const delay = pickRange(TICK_MIN_MS, TICK_MAX_MS);
      timerRef.current = setTimeout(() => {
        setCount((prev) => getNextCount(prev, min, max));
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mode, min, max]);

  // Real-mode is a no-op today; we render an "unavailable" pill so callers
  // can wire it up later without changing markup placement.
  if (mode === "real") {
    return (
      <span
        role="status"
        aria-label="Activity unavailable"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-pill border border-portal-border-soft bg-portal-panel-soft px-2.5 py-1 font-ui text-[10px] uppercase tracking-wider text-portal-text-soft",
          className,
        )}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-portal-text-soft"
        />
        Activity unavailable
      </span>
    );
  }

  if (!mounted) return null;

  const variant = COPY_VARIANTS[variantIndex] ?? COPY_VARIANTS[0]!;
  const fullLabel = variant(count);
  const shortLabel = `Demo: ${count}`;

  return (
    <span
      role="status"
      aria-label="Demo simulated activity counter"
      aria-live="polite"
      className={cn(
        // Pill chrome that matches the dark portal nav. Blue accents flag
        // "this is simulated" — a future real-presence pill should use green.
        "inline-flex items-center gap-1.5 rounded-pill border border-portal-blue/30 bg-portal-blue/10 px-2.5 py-1 font-ui text-[10px] uppercase tracking-wider text-portal-blue",
        className,
      )}
      style={{ color: "var(--accent-blue)" }}
      title={fullLabel}
    >
      <span
        aria-hidden
        className="demo-counter-pulse inline-block h-1.5 w-1.5 rounded-full bg-portal-blue"
      />
      {compact ? shortLabel : fullLabel}
    </span>
  );
}
