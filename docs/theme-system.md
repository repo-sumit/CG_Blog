# Theme system

CG SIGNAL supports three theme modes: **dark**, **light**, and **system**.
The implementation is hand-rolled (no `next-themes`) and runs on:

- A single set of CSS variables, scoped per `[data-theme="…"]` in `globals.css`.
- A pre-hydration inline script that paints the correct theme before React
  mounts — no flash of wrong colours.
- A small React provider that exposes `useTheme()` for components that need
  to read or change the mode.

## Files

```
lib/theme/theme-config.ts          # types + storage key
components/theme/ThemeScript.tsx   # pre-hydration paint-before-React script
components/theme/ThemeProvider.tsx # context + system listener + persistence
components/theme/ThemeToggle.tsx   # segmented sun / monitor / moon control
app/globals.css                    # [data-theme="dark"] + [data-theme="light"] blocks
app/layout.tsx                     # mounts <ThemeScript /> first, then <ThemeProvider>
tailwind.config.ts                 # darkMode: ["selector", "[data-theme=\"dark\"]"]
```

## How a theme swap propagates

1. User clicks `ThemeToggle` → `setMode("light")` is called on the provider.
2. The provider writes the choice to `localStorage` under `cg_signal_theme`.
3. It resolves `system` to either `dark` or `light` via `prefers-color-scheme`.
4. It stamps `data-theme="dark" | "light"` on `<html>`.
5. CSS variables under `[data-theme="…"]` in `globals.css` rebind in the same
   frame. Every component that reads `var(--bg-main)` / `var(--text-main)` /
   `var(--border-muted)` / etc. re-renders against the new palette
   automatically — no React tree update needed.

## Adding a new theme-aware colour

1. Add the variable under **both** `:root, [data-theme="dark"]` AND
   `[data-theme="light"]` blocks in `globals.css`. Same variable name on
   both sides — the only difference is the value.
2. If you want it as a Tailwind class, add a mapping under `theme.extend.colors`
   in `tailwind.config.ts` that reads `var(--your-new-var)`.
3. Use it like any other token: `bg-portal-something`, `text-portal-something`.

## What NOT to do

- Don't hard-code hex colours in component classNames. Use Tailwind's portal
  utilities or inline `style={{ color: "var(--xxx)" }}` if you need raw CSS.
- Don't read the persisted mode synchronously in components. The provider's
  `mode` is `system` until the first effect runs — that's intentional to
  match SSR markup.
- Don't put `dark:`-prefixed Tailwind utilities in NEW code. They still work
  via the `darkMode: ["selector", "[data-theme=\"dark\"]"]` config, but the
  CSS-variable approach scales better.

## Hydration safety

Server-rendered HTML doesn't know which theme the user picked — only the
browser does. We solve this with:

1. `suppressHydrationWarning` on `<html>` so React doesn't shout when the
   pre-hydration script mutates `data-theme`.
2. The inline `ThemeScript` runs as the first child of `<body>`. It reads
   `localStorage` (or `prefers-color-scheme`) and stamps `data-theme` on
   `<html>` *before* any CSS is applied to the paint tree.
3. The provider initial state matches SSR (`mode: "system"`, `resolved: "dark"`),
   and only diverges after the first effect runs on the client. By then the
   pre-hydration script has already applied the correct visible theme, so the
   user never sees a flash.

## Accessibility

- The segmented control uses `role="radiogroup"` + `role="radio"` with
  `aria-checked` — Tab to focus, arrow keys to navigate, Space/Enter to
  activate.
- The compact (mobile) variant is a single `<button>` with `aria-label`
  describing the current state and the action ("Theme: dark. Click to switch.").
- All focus rings use the design-system `--accent-blue` ring with a 2px
  offset, identical in both themes.
- `prefers-reduced-motion` already disables the animated decorations
  (signal-dot, ticker-track, demo-counter-pulse). The theme swap itself has
  no animation.
