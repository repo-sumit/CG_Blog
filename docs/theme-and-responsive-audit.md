# Theme system + responsive audit

Pre-implementation audit of the codebase before the dark / light / system theme
rollout, plus what to do about each finding.

## Theme audit

| Area | Current implementation | Theme issues | Fix strategy | Status |
|---|---|---|---|---|
| `globals.css` :root tokens | All colour, surface, text, and border vars are defined under a single `:root` block with dark-mode values | Without a `[data-theme="light"]` override block there's no path to swap palettes at runtime | Keep dark values under `:root, [data-theme="dark"]`. Add an editorial-light override under `[data-theme="light"]` with the same variable names so every consumer Just Works | ✅ done |
| `html { color-scheme: dark }` | Hard-coded `dark` in the global stylesheet | The browser-native form, scrollbar, and autofill colours stay dark even when the surface goes light | Made dynamic: `:root` defaults to `light`, `[data-theme="dark"]` flips it back. The pre-hydration script sets `data-theme` on `<html>` before any CSS runs, so the native chrome matches | ✅ done |
| Tailwind config (`tailwind.config.ts`) | Already maps every colour to a CSS variable (`hsl(var(--background))`, `var(--bg-main)`, etc.) | None — this is the reason a theme system is feasible at all without touching components | No change | ✅ ok |
| Components that hard-code colours | Sample-checked: most components use `text-portal-text`, `bg-portal-panel`, etc. which read from CSS vars. The exceptions are the landing hero (orange + blue radial gradients in inline `style`) and `PostThumbnail` placeholder gradients | These render fine in light mode against the new cream/paper background — the radial gradients are tinted with low-alpha brand colours that read on any surface | Leave as-is. Optional polish later: dial the alpha down further on light to keep the editorial paper feel | ✅ ok |
| Shadcn `--background` / `--foreground` HSL vars | Single set of HSL triples in `:root`, dark-tuned | These power `Badge` / `Button` shadcn variants — left dark, they'd produce dark-on-light text in light mode | Mirror the dark HSL block under `[data-theme="light"]` with light-tuned HSL triples | ✅ done |
| Existing theme toggle | `next-themes` not installed; no toggle UI | Need a from-scratch theme provider | Hand-rolled provider (~70 lines) over `localStorage` + `matchMedia` so we avoid the `next-themes` dependency + its hydration quirks for our use case | ✅ done |
| Hydration flicker | n/a — only one theme before | First paint must match user preference even on the very first request | Inline `<script>` injected before `<body>` reads `localStorage` + `prefers-color-scheme` and stamps `data-theme` on `<html>` before any React runs. Inline avoids the "wrong theme flash" problem entirely | ✅ done |

## Mobile responsiveness audit

| Area | Current state | Mobile issues | Fix strategy | Status |
|---|---|---|---|---|
| `<html> / <body>` overflow | `overflow-x: hidden` already set | Belt + suspenders against fixed-width content | Keep | ✅ ok |
| Editor toolbar | Was a single row of 25 buttons that overflowed off screen | Fixed earlier — `max-w-full overflow-x-auto` + `flex-wrap` | Keep | ✅ ok |
| Editor sidebar | Stacks below the canvas at `<lg` thanks to the existing `lg:grid-cols-[minmax(0,1fr)_320px]` grid | None observed | Keep | ✅ ok |
| Three publish buttons | `flex-col` on mobile, `flex-row` on `sm+` (already responsive) | None | Keep | ✅ ok |
| Landing hero title | `text-5xl sm:text-7xl` — readable but a bit huge on 360px screens | Could clamp tighter | Already responsive enough; tracked as a future polish | ⏸ deferred |
| Landing feed grid | `1 / 2 / 3` columns at `mobile / sm / lg` | Working | Keep | ✅ ok |
| Public nav | Already collapses (Signal Feed link hidden on `<md`, brand + sign-in stay) | None observed | Add theme toggle without breaking the layout | ✅ done |
| Dashboard top nav | Has a mobile horizontal-scroll nav strip already | Working | Add theme toggle to the right action cluster | ✅ done |
| `prefers-reduced-motion` | Already honoured for `ticker-track`, `signal-dot`, `demo-counter-pulse` | None | Keep | ✅ ok |

## What this pass deliberately doesn't change

- Per-component colour overrides — every existing `bg-portal-panel`, `text-portal-text` etc. already reads from a CSS variable, so the theme swap propagates without component edits.
- Tailwind config — already correctly maps to variables.
- Layout grids and spacing — already mobile-first.
- Decorative elements (concentric / scanlines / wireframe triangle in `PostThumbnail`) — they sit over a coloured gradient that reads on both themes.

## Limitations (known, accepted)

- The `PostThumbnail` placeholder uses a saturated brand-coloured gradient (orange / blue / green / etc.). On light mode this still works as a visual anchor — the saturation is intentionally high — but it's "loud" compared to the rest of light mode. Acceptable trade-off; sidesteps having to generate two palettes per post.
- The shadcn-style HSL aliases were tuned for dark; the light override picks reasonable defaults but third-party-aesthetic components (Sonner toasts, etc.) are left to inherit the same vars rather than getting hand-tuned light variants.
- We do NOT integrate `next-themes`. Reasons: the codebase is small, our control needs are minimal (light / dark / system + persist), and a hand-rolled provider avoids the package's known issue where the script tag inserts above `<body>` and can be deduped by some Next.js minor versions.
