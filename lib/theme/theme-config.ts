/**
 * Theme system shared between the pre-hydration script, the React provider,
 * and the toggle UI. Keeping these constants in a tiny module lets every
 * caller agree on the localStorage key + the set of valid modes without
 * importing React.
 */

/** What the user actually picked. `system` defers to OS preference. */
export type ThemeMode = "dark" | "light" | "system";

/** What we actually paint — `system` resolves to one of these. */
export type ResolvedTheme = "dark" | "light";

/** The set of legal mode strings, used for runtime validation. */
export const THEME_MODES: readonly ThemeMode[] = ["dark", "light", "system"] as const;

/** localStorage key for persisting the user's choice. */
export const THEME_STORAGE_KEY = "cg_signal_theme";

/** Default when nothing is stored yet — match OS so first-load looks native. */
export const DEFAULT_THEME_MODE: ThemeMode = "system";
