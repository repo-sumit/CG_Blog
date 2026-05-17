import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY } from "@/lib/theme/theme-config";

/**
 * Inline blocking script that runs BEFORE React hydrates. Reads the persisted
 * mode from localStorage and stamps `data-theme="light" | "dark"` on `<html>`
 * before any paint. The previous version honoured `prefers-color-scheme`;
 * that's gone with the system-theme removal — light is now the explicit
 * default for first-time visitors.
 *
 * Mount as the first child of `<body>` in the root layout — Next will
 * inline this verbatim into the document so it runs before any CSS applies.
 *
 * SAFETY NOTE on `dangerouslySetInnerHTML`:
 *   The injected code is built from compile-time constants (`THEME_STORAGE_KEY`
 *   and `DEFAULT_THEME_MODE`) routed through `JSON.stringify` — no runtime
 *   inputs reach this surface, so it is not XSS-exploitable. The script
 *   needs to be inline + synchronous so the theme is applied before first
 *   paint; `<Script strategy="beforeInteractive">` and `useEffect` both
 *   paint at least once with the wrong theme, which is the whole bug
 *   this exists to prevent. Do NOT touch this without rebuilding the
 *   theme bootstrap end-to-end.
 */
// Compile-time-only constants — these are the only values interpolated below.
const STORAGE_KEY_JSON = JSON.stringify(THEME_STORAGE_KEY);
const DEFAULT_MODE_JSON = JSON.stringify(DEFAULT_THEME_MODE);

const THEME_BOOTSTRAP_SCRIPT =
  `(function(){try{var k=${STORAGE_KEY_JSON};var d=${DEFAULT_MODE_JSON};` +
  `var m=null;try{m=window.localStorage.getItem(k)}catch(_){};` +
  `var t=(m==="dark"||m==="light")?m:d;` +
  `document.documentElement.setAttribute("data-theme",t)}` +
  `catch(e){document.documentElement.setAttribute("data-theme",${DEFAULT_MODE_JSON})}})();`;

export function ThemeScript() {
  return (
    <script
      // eslint-disable-next-line react/no-danger -- intentional inline preboot script; see file header.
      dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
    />
  );
}
