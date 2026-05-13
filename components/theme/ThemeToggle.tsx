"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils/cn";

interface Props {
  /** Compact: shows a single icon-button that flips on click. */
  compact?: boolean;
  className?: string;
}

/**
 * Two-state theme toggle. The system-preference mode was removed in May 2026
 * because users were unintentionally landing in the wrong theme on the
 * landing page — light is now the explicit default and the toggle just
 * flips between light and dark.
 *
 * Layouts:
 *   - default: segmented sun / moon pair (radiogroup, keyboard-navigable)
 *   - compact: a single icon button whose icon mirrors the OPPOSITE mode so
 *     the affordance reads as "switch to [other theme]" — the convention used
 *     by GitHub, Stripe, etc.
 */
export function ThemeToggle({ compact = false, className }: Props) {
  const { mode, setMode, toggle } = useTheme();

  // Match SSR markup on first paint, then enable real state once we've read
  // storage. Prevents an aria-checked / icon flicker on the first client tick.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (compact) {
    // Icon shows the destination, not the current state — i.e. clicking a
    // moon switches TO dark.
    const isDark = mounted && mode === "dark";
    const Icon = isDark ? Sun : Moon;
    const label = isDark ? "Switch to light theme" : "Switch to dark theme";
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={toggle}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-pill border border-portal-border-soft bg-portal-panel-soft text-portal-text-muted transition-colors",
          "hover:border-portal-border-muted hover:text-portal-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main",
          className,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  // Full segmented control: sun (light) | moon (dark).
  const options: { value: "light" | "dark"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill border border-portal-border-soft bg-portal-panel-soft p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
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
