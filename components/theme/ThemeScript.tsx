import { THEME_STORAGE_KEY } from "@/lib/theme/theme-config";

/**
 * Inline blocking script that runs BEFORE React hydrates. Reads the persisted
 * mode from localStorage (or falls back to `prefers-color-scheme`) and stamps
 * `data-theme="dark" | "light"` on `<html>`. Because it runs before the first
 * paint, there's no visible flash of the wrong theme.
 *
 * Mount this as the very first child of `<body>` in the root layout — Next
 * keeps the markup verbatim with `dangerouslySetInnerHTML`, so the code below
 * is exactly what ships to the browser. It deliberately avoids any external
 * dependency or build-time templating beyond the storage key constant.
 *
 * The script is intentionally compact (no comments inside the string body) —
 * Next will inline it into the document head and we don't want extra bytes.
 */
export function ThemeScript() {
  const code = `(function(){try{var k=${JSON.stringify(
    THEME_STORAGE_KEY,
  )};var m=null;try{m=window.localStorage.getItem(k)}catch(_){};var t;if(m==="dark"||m==="light"){t=m}else{t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"};document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();`;
  return (
    <script
      // eslint-disable-next-line react/no-danger -- intentional inline preboot script
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
