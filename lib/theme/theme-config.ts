/**
 * Theme system shared between the pre-hydration script, the React provider,
 * and the toggle UI. Keeping these constants in a tiny module lets every
 * caller agree on the localStorage key + the set of valid modes without
 * importing React.
 *
 * As of the May 2026 mobile/UX pass we removed the `system` mode — the app
 * now ships in light mode by default with an explicit dark toggle. A small
 * back-compat path in the provider rewrites any legacy `"system"` value in
 * storage to the new default so existing visitors don't see a broken state.
 */

/** What the user picked. Only the two explicit modes are supported. */
export type ThemeMode = "light" | "dark";

/** What's actually painted. Identical to `ThemeMode` now that system is gone. */
export type ResolvedTheme = "light" | "dark";

/** Legal modes — used for runtime validation against persisted strings. */
export const THEME_MODES: readonly ThemeMode[] = ["light", "dark"] as const;

/** localStorage key for the user's persisted choice. */
export const THEME_STORAGE_KEY = "cg_signal_theme";

/** Default mode applied when nothing is stored yet. */
export const DEFAULT_THEME_MODE: ThemeMode = "light";
