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
 */
export function ThemeScript() {
  const code = `(function(){try{var k=${JSON.stringify(
    THEME_STORAGE_KEY,
  )};var d=${JSON.stringify(
    DEFAULT_THEME_MODE,
  )};var m=null;try{m=window.localStorage.getItem(k)}catch(_){};var t=(m==="dark"||m==="light")?m:d;document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme",${JSON.stringify(
    DEFAULT_THEME_MODE,
  )})}})();`;
  return (
    <script
      // eslint-disable-next-line react/no-danger -- intentional inline preboot script
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
