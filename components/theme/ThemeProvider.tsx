"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_MODE,
  THEME_MODES,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme/theme-config";

interface ThemeContextValue {
  /** The user's choice — `light` or `dark`. */
  mode: ThemeMode;
  /** Same as `mode` now that the `system` option is gone. */
  resolved: ResolvedTheme;
  /** Persist a new choice and apply it immediately. */
  setMode: (next: ThemeMode) => void;
  /** Convenience flip — useful for icon buttons that swap on click. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && (THEME_MODES as readonly string[]).includes(raw)) {
      return raw as ThemeMode;
    }
    // Back-compat: a legacy `"system"` entry from the previous tri-state
    // version is silently migrated to the new default so the user doesn't
    // see a broken/unknown state on next visit.
    if (raw === "system") {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME_MODE);
      } catch {
        /* storage write may fail in private mode — fall through */
      }
    }
  } catch {
    // private mode / disabled storage — fall through to default
  }
  return DEFAULT_THEME_MODE;
}

function applyToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

/**
 * Wraps the app in theme state. The pre-hydration `ThemeScript` has already
 * stamped `data-theme` on `<html>`, so this provider's only job after mount
 * is to (a) re-read storage in case it changed between SSR and hydration and
 * (b) persist + re-apply when the user toggles. There's no system listener
 * anymore — the `system` mode was removed in the mobile/UX pass.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with the build-time default; the effect below replaces this with
  // the real stored value on the first client tick. We can't read
  // localStorage during SSR without risking a hydration mismatch.
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);

  useEffect(() => {
    const stored = readStoredMode();
    setModeState(stored);
    // Resync the visible theme to storage in the rare case the ThemeScript
    // and React state disagree (e.g. the user just opened a second tab and
    // changed it elsewhere).
    applyToDocument(stored);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage failures — the in-memory state still applies
    }
    applyToDocument(next);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved: mode, setMode, toggle }),
    [mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Outside the provider — return a stable read-only stub instead of
    // throwing so a stray import never crashes the page.
    return {
      mode: DEFAULT_THEME_MODE,
      resolved: DEFAULT_THEME_MODE,
      setMode: () => {
        /* no-op when outside ThemeProvider */
      },
      toggle: () => {
        /* no-op when outside ThemeProvider */
      },
    };
  }
  return ctx;
}
