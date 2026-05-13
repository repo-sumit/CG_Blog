"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils/cn";
import type { ThemeMode } from "@/lib/theme/theme-config";

interface Props {
  /** Compact layout: shows only the active mode's icon as an icon button. */
  compact?: boolean;
  className?: string;
}

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Segmented theme picker. Three icon buttons (light / system / dark) wrapped
 * in a pill — radio-group semantics so it's keyboard navigable. The pre-
 * hydration script already set the visible theme before React mounted; this
 * component just shows + sets the user's persisted choice.
 *
 * In `compact` mode (mobile / narrow navs) we render a single icon button
 * that cycles light → system → dark on click.
 */
export function ThemeToggle({ compact = false, className }: Props) {
  const { mode, setMode } = useTheme();
  // Match SSR markup on the first paint (mode = default), then enable the
  // real state once we've read storage. Without this guard the radio's
  // `aria-checked` would flicker on the first client tick.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (compact) {
    const order: ThemeMode[] = ["light", "system", "dark"];
    const idx = Math.max(0, order.indexOf(mode));
    const next = order[(idx + 1) % order.length]!;
    const ActiveIcon = OPTIONS.find((o) => o.value === mode)?.icon ?? Monitor;
    return (
      <button
        type="button"
        aria-label={`Theme: ${mode}. Click to switch.`}
        onClick={() => setMode(next)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-pill border border-portal-border-soft bg-portal-panel-soft text-portal-text-muted transition-colors",
          "hover:border-portal-border-muted hover:text-portal-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main",
          className,
        )}
      >
        <ActiveIcon className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill border border-portal-border-soft bg-portal-panel-soft p-0.5",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mounted && mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setMode(opt.value)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-pill transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main",
              active
                ? "bg-portal-panel-raised text-portal-text shadow-sm"
                : "text-portal-text-muted hover:text-portal-text",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
