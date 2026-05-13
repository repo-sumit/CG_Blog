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
  /** What the user picked. `system` means "follow OS preference". */
  mode: ThemeMode;
  /** What is actually painted right now. Always `dark` or `light`. */
  resolved: ResolvedTheme;
  /** Persist a new choice and apply it immediately. */
  setMode: (next: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && (THEME_MODES as readonly string[]).includes(raw)) {
      return raw as ThemeMode;
    }
  } catch {
    // private mode / disabled storage — fall through
  }
  return DEFAULT_THEME_MODE;
}

function systemPrefers(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? systemPrefers() : mode;
}

function applyToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

/**
 * Wraps the app in theme state. The pre-hydration `ThemeScript` has already
 * stamped `data-theme` on `<html>`, so this provider's only job after mount
 * is to:
 *   1. Re-read storage in case it changed between SSR and hydration.
 *   2. Listen to `prefers-color-scheme` changes when mode === "system".
 *   3. Persist + re-apply when the user toggles.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with the default; the effect below replaces this with the real
  // stored value on the first client tick. We can't read localStorage during
  // SSR / first render without risking a hydration mismatch.
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // On mount: pick up the stored choice + the actual painted resolved value
  // (the ThemeScript already set `data-theme`, so we can read it back).
  useEffect(() => {
    const stored = readStoredMode();
    setModeState(stored);
    const initialResolved =
      (document.documentElement.getAttribute("data-theme") as ResolvedTheme | null) ??
      resolve(stored);
    setResolved(initialResolved);
  }, []);

  // System-preference listener — only re-applies when mode === "system".
  useEffect(() => {
    if (mode !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolved(next);
      applyToDocument(next);
    };
    // Sync once in case the user toggled the OS while the tab was idle.
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage failures — the in-memory state still applies
    }
    const nextResolved = resolve(next);
    setResolved(nextResolved);
    applyToDocument(nextResolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Outside the provider — return a stable read-only stub instead of
    // throwing so a stray import doesn't crash the page.
    return {
      mode: DEFAULT_THEME_MODE,
      resolved: "dark",
      setMode: () => {
        /* no-op when outside ThemeProvider */
      },
    };
  }
  return ctx;
}
