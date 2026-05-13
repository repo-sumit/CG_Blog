# Theme: light default, system mode removed

## What changed

Previously the app supported three modes: `light`, `dark`, and `system`
(follow OS preference). After the May 2026 mobile/UX pass we removed `system`
and made `light` the explicit default. Reasons:

1. Visitors landing from external sources (Slack previews, email links) often
   ended up in dark mode unexpectedly because their OS preference defaulted to
   dark. The post hero photography and brand chrome look better on cream.
2. A two-state toggle is easier to grok than a tri-state selector — the
   compact icon-button variant on mobile now reads as "click this to switch
   to the OTHER theme", same as GitHub / Stripe / Linear.

## API

`lib/theme/theme-config.ts`:

```ts
export type ThemeMode = "light" | "dark";        // (was "light" | "dark" | "system")
export const DEFAULT_THEME_MODE = "light";       // (was "system")
```

The provider's `mode` and `resolved` are now the same value. `mode === "system"`
is no longer reachable.

## Back-compat

Legacy `"system"` values in `localStorage` are silently rewritten to the new
default on the next read so existing visitors don't see a broken state. The
rewrite happens inside `readStoredMode()` in `ThemeProvider.tsx`:

```ts
if (raw === "system") {
  window.localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME_MODE);
}
```

## Toggle UI

### Default (sm+)

Segmented sun / moon pair, `role="radiogroup"`. Tab to focus, Space/Enter to
activate.

### Compact (mobile)

A single icon button whose icon mirrors the **opposite** state:
- showing 🌙 → click switches to dark
- showing ☀️ → click switches to light

`aria-label` always describes the destination ("Switch to dark theme").

## No flicker

The pre-hydration `ThemeScript` runs as the first child of `<body>` and
stamps `data-theme="light" | "dark"` on `<html>` before any CSS applies.
Because light is now the SSR default in the markup, first-time visitors see
the correct light theme paint immediately — no flash.

## What the toggle does NOT do

- It doesn't follow OS dark-mode toggling at runtime (that was the only thing
  `system` mode did — gone with it).
- It doesn't sync across tabs in real time. If you want that, the provider's
  `useEffect` could listen for `storage` events; deliberately omitted to keep
  the component surface small.

## Migration steps if a future maintainer wants `system` back

1. Re-add `"system"` to the `ThemeMode` union in `theme-config.ts`.
2. Re-introduce the `prefers-color-scheme` `matchMedia` listener in
   `ThemeProvider.tsx` gated to `mode === "system"`.
3. Add the `Monitor` icon back to `ThemeToggle.tsx`'s `OPTIONS` array.
4. Restore the compact button's three-state cycle (light → system → dark).

All four files are < 150 lines, so the revert is small.
